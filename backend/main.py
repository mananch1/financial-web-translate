"""FastAPI backend for the NSE corporate-filings-announcements clone.

Exposes a clean REST surface on top of NSE's public (undocumented) JSON
endpoints. The Next.js frontend talks only to this server, never directly
to nseindia.com -- this keeps CORS/cookie handling in one place.

Endpoints
---------
GET  /api/health                       -> {ok: true}
GET  /api/market-snapshot              -> Nifty 50, USD/INR, market-cap headline numbers
GET  /api/announcements?index=...      -> announcements for one of the
                                          tabs: equities | sme | debt | mf |
                                                invitsreits | municipalbond |
                                                sse | dt | votingresults
                                          Optional: from_date (dd-mm-yyyy),
                                          to_date, symbol, fo_sec (true/false)
GET  /api/announcements/xbrl?index=... -> XBRL variant for the same tab
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from es_client import get_es, shutdown_es
from nse_client import get_client, shutdown_client
from translator_client import get_translator, shutdown_translator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("nse-backend")


# ---------------------------------------------------------------------------
# Mapping: frontend tab id  ->  NSE `index` query value used by their site.
# Discovered by inspecting the Network tab on
# https://www.nseindia.com/companies-listing/corporate-filings-announcements
# ---------------------------------------------------------------------------
INDEX_MAP: dict[str, str] = {
    "equities": "equities",
    "sme": "sme",
    "debt": "debt",
    "mf": "mf",
    "invitsreits": "invitsreits",
    "municipalbond": "municipalbond",
    "sse": "sse",
    "dt": "debt",  # DT Disclosures shares the debt endpoint with extra filter
    "votingresults": "equities",  # voting-results uses a different path entirely
}


# Cap on rows returned per request. Keeps eager translation feasible on
# Groq's free tier and ES indexing tight. NSE returns newest-first so
# "top 50" naturally means the 50 most recent announcements.
MAX_ROWS = int(os.environ.get("MAX_ROWS", "50"))

# Fields on an announcement row that contain prose worth translating.
# Symbols, dates, ISINs and file URLs are deliberately excluded.
TRANSLATABLE_FIELDS: tuple[str, ...] = ("desc", "attchmntText", "smIndustry")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # warm the session on boot so the first user request is fast
    try:
        await get_client()._warmup()  # noqa: SLF001
    except Exception as e:  # pragma: no cover - best effort
        logger.warning("startup warmup failed: %s", e)

    # Probe Elasticsearch once. If it's down we still serve English,
    # and translation falls through directly to translate-api.
    es = get_es()
    if await es.ping():
        logger.info("ES connected at %s", es.url)
    else:
        logger.warning("ES not reachable at %s — translations will not be cached", es.url)

    yield

    await shutdown_client()
    await shutdown_translator()
    await shutdown_es()


app = FastAPI(
    title="NSE Corporate Filings Proxy",
    version="0.1.0",
    description="Backend for the NSE corporate-filings-announcements clone.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"ok": True}


# ---------------------------------------------------------------------------
# Market snapshot used by the top ticker band.
#
# NSE serves everything the real ticker shows from a single endpoint:
#   /api/marketStatus
#
# Shape (abbreviated):
#   {
#     "marketState": [
#       { "market": "Capital Market", "index": "NIFTY 50",
#         "last": 23719.3, "variation": 64.6, "percentChange": 0.27,
#         "marketStatus": "Closed",
#         "marketStatusMessage": "Normal Market has Closed",
#         "tradeDate": "22-May-2026 15:30" },
#       ...,
#       { "market": "currencyfuture", "last": "99.28",
#         "underlying": "USDINR",
#         "expiryDate": "22-May-2026", "updated_time": "22-May-2026 12:28" }
#     ],
#     "marketcap": {
#       "marketCapinLACCRRupeesFormatted": "463.23",
#       "marketCapinTRDollars": 4.83,
#       "timeStamp": "22-May-2026"
#     },
#     "giftnifty": {
#       "SYMBOL": "NIFTY", "EXPIRYDATE": "26-May-2026",
#       "LASTPRICE": 23702.5, "DAYCHANGE": -62.5, "PERCHANGE": -0.26,
#       "TIMESTMP": "22-May-2026 17:34"
#     }
#   }
# ---------------------------------------------------------------------------
def _to_float(v: Any) -> float | None:
    if v is None or v == "" or v == "-":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


@app.get("/api/market-snapshot")
async def market_snapshot() -> dict[str, Any]:
    client = get_client()
    try:
        ms = await client.get("/api/marketStatus")
    except httpx.HTTPError as e:
        logger.warning("market-snapshot failed: %s", e)
        ms = {}

    market_state = ms.get("marketState", []) or []
    capital_market = next(
        (m for m in market_state if m.get("market") == "Capital Market"), {}
    )
    currency_future = next(
        (m for m in market_state if m.get("market") == "currencyfuture"), {}
    )
    gift = ms.get("giftnifty", {}) or {}
    mcap = ms.get("marketcap", {}) or {}

    return {
        "nifty50": {
            "last": _to_float(capital_market.get("last")),
            "change": _to_float(capital_market.get("variation")),
            "percentChange": _to_float(capital_market.get("percentChange")),
            "status": capital_market.get("marketStatus"),
            "statusMessage": capital_market.get("marketStatusMessage"),
            "asOf": capital_market.get("tradeDate"),
        },
        "futures": {
            "symbol": gift.get("SYMBOL"),
            "expiry": gift.get("EXPIRYDATE"),
            "last": _to_float(gift.get("LASTPRICE")),
            "change": _to_float(gift.get("DAYCHANGE")),
            "percentChange": _to_float(gift.get("PERCHANGE")),
            "asOf": gift.get("TIMESTMP"),
        },
        "usdinr": {
            "last": _to_float(currency_future.get("last")),
            "expiry": currency_future.get("expiryDate"),
            "asOf": currency_future.get("updated_time"),
        },
        "marketCap": {
            "lacCrs": _to_float(
                mcap.get("marketCapinLACCRRupees")
                or mcap.get("marketCapinLACCRRupeesFormatted")
            ),
            "tnUSD": _to_float(mcap.get("marketCapinTRDollars")),
            "asOf": mcap.get("timeStamp"),
        },
        "marketStates": [
            {
                "market": m.get("market"),
                "status": m.get("marketStatus"),
                "message": m.get("marketStatusMessage"),
            }
            for m in market_state
            if m.get("market") not in ("currencyfuture",)
        ],
    }


# ---------------------------------------------------------------------------
# Symbol / company autocomplete used by the search box.
# ---------------------------------------------------------------------------
@app.get("/api/autocomplete")
async def autocomplete(q: str = Query("", min_length=0)) -> dict[str, Any]:
    if not q.strip():
        return {"q": q, "symbols": []}
    client = get_client()
    try:
        data = await client.get(
            "/api/search/autocomplete", params={"q": q}
        )
    except httpx.HTTPError as e:
        logger.warning("autocomplete failed: %s", e)
        return {"q": q, "symbols": []}
    # NSE returns {symbols: [{symbol, symbol_info, ...}], ...}
    rows = data.get("symbols", []) if isinstance(data, dict) else []
    return {
        "q": q,
        "symbols": [
            {
                "symbol": r.get("symbol"),
                "name": r.get("symbol_info") or r.get("name"),
                "type": r.get("type") or r.get("activeSeries"),
            }
            for r in rows[:20]
        ],
    }


# ---------------------------------------------------------------------------
# Translation cache-aside flow shared by /api/announcements and the XBRL
# variant. Strategy per request when lang != "en":
#
#   1. mget ES by doc id ({tab}:{seq_id}) -> some rows come back already
#      translated. Splice those translated prose fields into the live row
#      (so the user sees the latest NSE metadata + cached translations).
#   2. For misses, gather unique prose strings, call translate-api once,
#      splice translations back into each miss row.
#   3. Bulk-index newly translated rows so the next request is fast.
#
# Cache stats are returned to make the demo legible: you can see
# `cacheHits` climb as you re-fetch.
# ---------------------------------------------------------------------------
async def _translate_rows(
    rows: list[dict[str, Any]],
    tab: str,
    lang: str,
) -> dict[str, int]:
    """Translate `rows` in place. Returns {hits, misses, total} for logging."""
    stats = {"hits": 0, "misses": 0, "total": len(rows)}
    if lang == "en" or not rows:
        return stats

    es = get_es()
    await es.ensure_index(lang)

    # Map doc-id -> row index for splicing.
    id_to_idx: dict[str, int] = {}
    uncacheable: list[int] = []
    for i, row in enumerate(rows):
        doc_id = es.doc_id(tab, row.get("seq_id"))
        if doc_id is None:
            uncacheable.append(i)
        else:
            id_to_idx[doc_id] = i

    # 1. mget against ES
    cached = await es.mget(lang, list(id_to_idx.keys()))
    hit_indices: set[int] = set()
    for doc_id, src in cached.items():
        idx = id_to_idx[doc_id]
        for f in TRANSLATABLE_FIELDS:
            if f in src and src[f] is not None:
                rows[idx][f] = src[f]
        hit_indices.add(idx)
    stats["hits"] = len(hit_indices)

    # 2. Translate misses (cacheable + uncacheable)
    miss_indices = [i for i in range(len(rows)) if i not in hit_indices]
    stats["misses"] = len(miss_indices)
    if not miss_indices:
        return stats

    # Collect unique prose values across all miss rows.
    miss_texts: list[str] = []
    for i in miss_indices:
        for f in TRANSLATABLE_FIELDS:
            v = rows[i].get(f)
            if isinstance(v, str) and v.strip():
                miss_texts.append(v)

    translator = get_translator()
    translation_map = await translator.translate_unique(miss_texts, lang)
    if not translation_map:
        # translate-api failed (or all strings empty) — return EN values.
        return stats

    # Splice translations back into miss rows.
    for i in miss_indices:
        for f in TRANSLATABLE_FIELDS:
            v = rows[i].get(f)
            if isinstance(v, str) and v in translation_map:
                rows[i][f] = translation_map[v]

    # 3. Bulk-index the new translations. We store the *whole row* so
    # subsequent visits can splice without re-translating.
    now = datetime.now(timezone.utc).isoformat()
    to_index: list[tuple[str, dict[str, Any]]] = []
    for i in miss_indices:
        if i in uncacheable:
            continue
        doc_id = es.doc_id(tab, rows[i].get("seq_id"))
        if doc_id is None:
            continue
        src = dict(rows[i])
        src["_source_lang"] = "en"
        src["_target_lang"] = lang
        src["_cached_at"] = now
        to_index.append((doc_id, src))
    if to_index:
        await es.bulk_index(lang, to_index)

    return stats


# ---------------------------------------------------------------------------
# Announcements (HTML/PDF variant) -- powers the main results table.
# ---------------------------------------------------------------------------
@app.get("/api/announcements")
async def announcements(
    index: str = Query("equities", description="tab id"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    symbol: str | None = None,
    subject: str | None = None,
    fo_sec: bool = False,
    lang: str = Query("en", description="target language code, e.g. 'hi'"),
) -> dict[str, Any]:
    if index not in INDEX_MAP:
        raise HTTPException(400, f"unknown index '{index}'")

    params: dict[str, Any] = {"index": INDEX_MAP[index]}
    if from_date:
        params["from_date"] = from_date
    if to_date:
        params["to_date"] = to_date
    if symbol:
        params["symbol"] = symbol
    if subject:
        params["subject"] = subject
    if fo_sec:
        params["fo_sec"] = "true"

    # Voting results live on a different endpoint.
    path = (
        "/api/corporate-voting-results"
        if index == "votingresults"
        else "/api/corporate-announcements"
    )

    client = get_client()
    try:
        data = await client.get(path, params=params)
    except httpx.HTTPError as e:
        logger.exception("announcements proxy failed")
        raise HTTPException(502, f"upstream NSE error: {e}") from e

    raw_rows = data if isinstance(data, list) else data.get("data", data) or []
    if not isinstance(raw_rows, list):
        raw_rows = []

    # Cap to MAX_ROWS so eager translation stays cheap.
    total_available = len(raw_rows)
    rows = raw_rows[:MAX_ROWS]

    stats = await _translate_rows(rows, tab=index, lang=lang.lower())
    return {
        "index": index,
        "count": len(rows),
        "total": total_available,
        "rows": rows,
        "lang": lang.lower(),
        "cacheStats": stats,
    }


@app.get("/api/announcements/xbrl")
async def announcements_xbrl(
    index: str = Query("equities"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    symbol: str | None = None,
    lang: str = Query("en"),
) -> dict[str, Any]:
    if index not in INDEX_MAP:
        raise HTTPException(400, f"unknown index '{index}'")

    params: dict[str, Any] = {"index": INDEX_MAP[index]}
    if from_date:
        params["from_date"] = from_date
    if to_date:
        params["to_date"] = to_date
    if symbol:
        params["symbol"] = symbol

    client = get_client()
    try:
        data = await client.get("/api/XBRL-announcements", params=params)
    except httpx.HTTPError as e:
        logger.exception("xbrl announcements proxy failed")
        raise HTTPException(502, f"upstream NSE error: {e}") from e

    raw_rows = data if isinstance(data, list) else data.get("data", data) or []
    if not isinstance(raw_rows, list):
        raw_rows = []

    total_available = len(raw_rows)
    rows = raw_rows[:MAX_ROWS]

    stats = await _translate_rows(rows, tab=f"{index}-xbrl", lang=lang.lower())
    return {
        "index": index,
        "count": len(rows),
        "total": total_available,
        "rows": rows,
        "lang": lang.lower(),
        "cacheStats": stats,
    }
