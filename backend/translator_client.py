"""Thin async client for the translate-api service (port 8100).

Backend talks to translate-api whenever it has to translate an
announcement's prose fields. Calls are deduped (the same subject like
"Board Meeting Intimation" appears many times in one batch — we only
send each unique string once) and bounded by a small timeout so a slow
translate-api never wedges /api/announcements.
"""
from __future__ import annotations

import logging
import os
from typing import Iterable

import httpx

logger = logging.getLogger("nse-backend.translator")

TRANSLATE_API = os.environ.get("TRANSLATE_API_URL", "http://127.0.0.1:8100")


class TranslatorClient:
    def __init__(self, base_url: str = TRANSLATE_API) -> None:
        self._base = base_url.rstrip("/")
        # 60s budget — translate-api itself may need to call Groq several
        # times in batches on a cold cache. Per-string the marginal cost
        # is small; the upper bound matters only on cold-boot.
        self._client = httpx.AsyncClient(
            base_url=self._base,
            timeout=httpx.Timeout(60.0, connect=5.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def translate_unique(
        self,
        texts: Iterable[str],
        lang: str,
    ) -> dict[str, str]:
        """Translate every unique string in `texts` to `lang`.

        Returns a map ``{source -> translation}`` so callers can splice
        translations back into a list of rows that share strings.

        Empty inputs / non-strings are ignored. Returns ``{}`` for the
        passthrough case ``lang == "en"``.
        """
        if lang == "en":
            return {}

        # Dedup + drop empties. Preserves insertion order so the
        # translate-api response lines up by index.
        uniq: list[str] = []
        seen: set[str] = set()
        for t in texts:
            if not isinstance(t, str):
                continue
            s = t.strip()
            if not s or s in seen:
                continue
            seen.add(s)
            uniq.append(t)  # keep original (whitespace preserved)

        if not uniq:
            return {}

        try:
            r = await self._client.post(
                "/translate",
                json={"language": lang, "texts": uniq},
            )
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError) as e:
            logger.warning("translate-api call failed (%d strings): %s", len(uniq), e)
            return {}

        translations = data.get("translations", []) or []
        if len(translations) != len(uniq):
            logger.warning(
                "translate-api length mismatch: sent=%d got=%d",
                len(uniq),
                len(translations),
            )
            return {}

        return {src: tr for src, tr in zip(uniq, translations)}


_singleton: TranslatorClient | None = None


def get_translator() -> TranslatorClient:
    global _singleton
    if _singleton is None:
        _singleton = TranslatorClient()
    return _singleton


async def shutdown_translator() -> None:
    global _singleton
    if _singleton is not None:
        await _singleton.aclose()
        _singleton = None
