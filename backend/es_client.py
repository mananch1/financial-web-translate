"""Thin async Elasticsearch wrapper used as a row-level translation cache.

Design notes
------------
* One index per target language: ``nse-announcements-{lang}`` (e.g.
  ``nse-announcements-hi``). Per-language indexes keep mappings simple
  and make wiping a single language trivial (``DELETE`` the index).
* Document id encodes the tab + NSE row id: ``{tab}:{seq_id}``. This way
  the same row across two tabs (rare, but possible) stays distinct, and
  the same row in different *languages* lives in different indexes.
* Mapping is ``dynamic=false`` for everything except a handful of fields
  we'll later want to filter / sort on. The point is to be a cache, not
  a search index (yet).
* All operations are best-effort: if ES is down the caller falls back
  to translating every row from scratch. That keeps the system live
  even if WSL/Docker is asleep.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from elasticsearch import AsyncElasticsearch
from elasticsearch.exceptions import (
    ConnectionError as ESConnectionError,
    NotFoundError,
    TransportError,
)

logger = logging.getLogger("nse-backend.es")

ES_URL = os.environ.get("ES_URL", "http://127.0.0.1:9200")
ES_INDEX_PREFIX = os.environ.get("ES_INDEX_PREFIX", "nse-announcements")


# Minimal mapping — we treat the index as a key/value cache, not a search
# corpus. `dynamic: true` makes ES auto-index any prose field, which we
# DON'T want (cheap to add later when we wire actual search).
_INDEX_BODY: dict[str, Any] = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
    "mappings": {
        "dynamic": "true",
        "properties": {
            "seq_id":      {"type": "keyword"},
            "tab":         {"type": "keyword"},
            "symbol":      {"type": "keyword"},
            "_source_lang":{"type": "keyword"},
            "_target_lang":{"type": "keyword"},
            "_cached_at":  {"type": "date"},
        },
    },
}


class TranslationCacheES:
    """Async ES wrapper. Safe to use even when ES is unreachable."""

    def __init__(self, url: str = ES_URL) -> None:
        self._url = url
        # request_timeout keeps a hung ES from blocking the request thread.
        self._client = AsyncElasticsearch(
            hosts=[url],
            request_timeout=3,
            max_retries=1,
            retry_on_timeout=False,
        )
        self._ready = False
        # Track indexes we've already ensured this process to avoid
        # the round-trip on every call.
        self._ensured: set[str] = set()

    @property
    def url(self) -> str:
        return self._url

    @property
    def healthy(self) -> bool:
        return self._ready

    def index_for(self, lang: str) -> str:
        return f"{ES_INDEX_PREFIX}-{lang.lower()}"

    @staticmethod
    def doc_id(tab: str, seq_id: str | int | None) -> str | None:
        """Return a stable doc id or None if the row can't be cached."""
        if seq_id is None or seq_id == "":
            return None
        return f"{tab}:{seq_id}"

    async def ping(self) -> bool:
        """Cheap health check — call once at startup, then trust `healthy`."""
        try:
            ok = await self._client.ping()
            self._ready = bool(ok)
            if not self._ready:
                logger.warning("ES at %s did not respond to ping", self._url)
        except (ESConnectionError, TransportError, Exception) as e:
            self._ready = False
            logger.warning("ES ping failed (%s): %s", self._url, e)
        return self._ready

    async def ensure_index(self, lang: str) -> None:
        """Create the per-language index on first use. No-op if it exists."""
        idx = self.index_for(lang)
        if idx in self._ensured:
            return
        try:
            exists = await self._client.indices.exists(index=idx)
            if not exists:
                await self._client.indices.create(index=idx, body=_INDEX_BODY)
                logger.info("Created ES index %s", idx)
            self._ensured.add(idx)
        except (ESConnectionError, TransportError) as e:
            logger.warning("ensure_index(%s) failed: %s", idx, e)

    async def mget(
        self,
        lang: str,
        ids: list[str],
    ) -> dict[str, dict[str, Any]]:
        """Fetch many cached rows in one round trip.

        Returns a dict keyed by doc id; missing docs are simply absent.
        Returns {} on any error so callers can treat ES as cold cache.
        """
        if not ids or not self._ready:
            return {}
        idx = self.index_for(lang)
        try:
            resp = await self._client.mget(index=idx, ids=ids)
        except NotFoundError:
            # Index doesn't exist yet — same as "no hits".
            return {}
        except (ESConnectionError, TransportError) as e:
            logger.warning("ES mget failed: %s", e)
            return {}

        out: dict[str, dict[str, Any]] = {}
        for doc in resp.get("docs", []):
            if doc.get("found") and doc.get("_source"):
                out[doc["_id"]] = doc["_source"]
        return out

    async def bulk_index(
        self,
        lang: str,
        docs: list[tuple[str, dict[str, Any]]],
    ) -> int:
        """Index many translated rows. Best-effort, returns count written.

        `docs` is a list of (doc_id, source) tuples.
        """
        if not docs or not self._ready:
            return 0
        idx = self.index_for(lang)

        # Hand-built bulk body (avoids the async-helpers import which has
        # a quirky API surface across versions).
        body: list[dict[str, Any]] = []
        for doc_id, source in docs:
            body.append({"index": {"_index": idx, "_id": doc_id}})
            body.append(source)

        try:
            resp = await self._client.bulk(operations=body, refresh=False)
        except (ESConnectionError, TransportError) as e:
            logger.warning("ES bulk_index failed: %s", e)
            return 0

        if resp.get("errors"):
            n_err = sum(1 for it in resp.get("items", []) if it.get("index", {}).get("error"))
            logger.warning("ES bulk had %d errors", n_err)

        return len(docs)

    async def count(self, lang: str) -> int:
        """Doc count for a language index. -1 on error."""
        if not self._ready:
            return -1
        try:
            r = await self._client.count(index=self.index_for(lang))
            return int(r.get("count", 0))
        except (ESConnectionError, TransportError, NotFoundError):
            return -1

    async def aclose(self) -> None:
        try:
            await self._client.close()
        except Exception:  # pragma: no cover
            pass


_es_singleton: TranslationCacheES | None = None


def get_es() -> TranslationCacheES:
    global _es_singleton
    if _es_singleton is None:
        _es_singleton = TranslationCacheES()
    return _es_singleton


async def shutdown_es() -> None:
    global _es_singleton
    if _es_singleton is not None:
        await _es_singleton.aclose()
        _es_singleton = None
