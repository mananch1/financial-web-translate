"""Thin async client for the public NSE India website APIs.

NSE blocks naked requests; you must:
  1. Use realistic browser headers.
  2. Visit a "warm-up" page first so the server sets session cookies
     (nseappid, bm_sv, etc.) before hitting the JSON endpoints.
  3. Re-warm whenever the cookies expire (~10 min) or the API
     returns 401/403/HTML.

This module wraps all of that behind a single `NSEClient.get(path, params)`
helper. It is intentionally framework-free so it can be reused outside FastAPI.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

NSE_BASE = "https://www.nseindia.com"

# Browser-ish headers. NSE's edge (Akamai) inspects UA + Accept-Language.
DEFAULT_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/127.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Referer": f"{NSE_BASE}/companies-listing/corporate-filings-announcements",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

# Pages we hit during warm-up so NSE drops the session cookies we need.
WARMUP_PATHS: tuple[str, ...] = (
    "/",
    "/companies-listing/corporate-filings-announcements",
    "/market-data/live-equity-market",
)

# How long a warmed session is considered fresh (seconds).
SESSION_TTL_SECONDS = 8 


class NSEClient:
    """Async, cookie-aware proxy to nseindia.com.

    Use a single instance for the lifetime of the app (`get_client()` below).
    """

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=NSE_BASE,
            headers=DEFAULT_HEADERS,
            timeout=httpx.Timeout(15.0, connect=10.0),
            follow_redirects=True,
            http2=False,
        )
        self._warmed_at: float = 0.0
        self._lock = asyncio.Lock()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _warmup(self, force: bool = False) -> None:
        """Hit a few HTML pages so NSE seeds session cookies on our jar."""
        async with self._lock:
            if not force and (time.time() - self._warmed_at) < SESSION_TTL_SECONDS:
                return
            self._client.cookies.clear()
            for path in WARMUP_PATHS:
                try:
                    r = await self._client.get(path, headers={"Accept": "text/html"})
                    logger.debug("warmup %s -> %s", path, r.status_code)
                except httpx.HTTPError as e:
                    logger.warning("warmup %s failed: %s", path, e)
            self._warmed_at = time.time()

    async def get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        retries: int = 2,
    ) -> Any:
        """GET a JSON endpoint, warming the session as needed.

        Returns parsed JSON (dict / list). Raises httpx.HTTPStatusError on
        non-recoverable failures after retries.
        """
        await self._warmup()
        last_exc: Exception | None = None
        for attempt in range(retries + 1):
            try:
                r = await self._client.get(path, params=params)
                if r.status_code in (401, 403) or "text/html" in r.headers.get(
                    "content-type", ""
                ):
                    logger.info(
                        "NSE returned %s for %s, re-warming session", r.status_code, path
                    )
                    await self._warmup(force=True)
                    continue
                r.raise_for_status()
                return r.json()
            except (httpx.HTTPError, ValueError) as e:
                last_exc = e
                logger.warning(
                    "NSE GET %s failed (attempt %d/%d): %s",
                    path,
                    attempt + 1,
                    retries + 1,
                    e,
                )
                await asyncio.sleep(0.6 * (attempt + 1))
                await self._warmup(force=True)
        assert last_exc is not None
        raise last_exc


_client_singleton: NSEClient | None = None


def get_client() -> NSEClient:
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = NSEClient()
    return _client_singleton


async def shutdown_client() -> None:
    global _client_singleton
    if _client_singleton is not None:
        await _client_singleton.aclose()
        _client_singleton = None