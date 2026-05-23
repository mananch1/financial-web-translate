"""Async Groq client for English -> Indian-language translation.

Uses Groq's OpenAI-compatible chat-completions endpoint. We talk to it via
`httpx` directly to keep the dependency tree small.

The system prompt is purpose-built for NSE-style corporate disclosure text:
  * formal register
  * preserve ALL CAPS tokens (NSE, BSE, IPO, NIFTY, ISIN, ...)
  * preserve numbers / dates / tickers / ISINs / proper nouns
  * output ONLY the translation, no commentary
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

GROQ_BASE = "https://api.groq.com/openai/v1"

# Tuned for the free tier's 12k tokens-per-minute budget.
# 10 prose strings ~= 800-1200 input tokens, leaving ample headroom so
# sequential calls (GROQ_MAX_CONCURRENCY=1) don't trip the TPM cap.
DEFAULT_BATCH_SIZE = int(os.environ.get("GROQ_BATCH_SIZE", "10"))


def _env(name: str, default: str) -> str:
    v = os.environ.get(name)
    return v if v is not None and v != "" else default


# Human-readable language labels for the prompt. NSE's language switcher
# offers exactly these tags.
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi (हिन्दी)",
    "mr": "Marathi (मराठी)",
    "gu": "Gujarati (ગુજરાતી)",
    "bn": "Bengali (বাংলা)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "ta": "Tamil (தமிழ்)",
    "te": "Telugu (తెలుగు)",
    "pa": "Punjabi (ਪੰਜਾਬੀ)",
    "ml": "Malayalam (മലയാളം)",
    "or": "Odia (ଓଡ଼ିଆ)",
    "as": "Assamese (অসমীয়া)",
    "ur": "Urdu (اردو)",
}


def language_label(tag: str) -> str:
    return LANGUAGE_NAMES.get(tag.lower(), tag)


SYSTEM_PROMPT = (
    "You are a professional translator for the National Stock Exchange of "
    "India (NSE) website. Translate the user's English text into formal "
    "{language}, suitable for an official stock exchange disclosure, "
    "announcement or filing.\n"
    "\n"
    "Strict rules:\n"
    "1. Use formal, professional register. No colloquialisms.\n"
    "2. Any word written in ALL CAPS in the source MUST stay in ALL CAPS "
    "in the translation (e.g. NSE, BSE, SEBI, IPO, NIFTY, ISIN, AGM, EGM, "
    "QIP, FPO, FII, DII, GST, PAN, KYC).\n"
    "3. Preserve numbers, dates, percentages, currency amounts, ISIN codes, "
    "ticker symbols (e.g. RELIANCE, TCS, HDFCBANK) and proper nouns "
    "exactly as written.\n"
    "4. Output ONLY the translated text. Do NOT include the source text, "
    "explanations, quotation marks, prefixes like 'Translation:', "
    "or any commentary.\n"
)


BATCH_SYSTEM_PROMPT = (
    "You are a professional translator for the National Stock Exchange of "
    "India (NSE) website. The user will send a JSON array of English "
    "strings. Translate each string into formal {language}.\n"
    "\n"
    "Strict rules:\n"
    "1. Use formal, professional register suitable for stock-exchange "
    "disclosures, announcements and filings. No colloquialisms.\n"
    "2. Any word written in ALL CAPS in the source MUST stay in ALL CAPS "
    "in the translation (e.g. NSE, BSE, SEBI, IPO, NIFTY, ISIN, AGM, EGM, "
    "QIP, FPO, FII, DII, GST, PAN, KYC).\n"
    "3. Preserve numbers, dates, percentages, currency amounts, ISIN codes, "
    "ticker symbols (e.g. RELIANCE, TCS, HDFCBANK) and proper nouns "
    "exactly as written.\n"
    "4. Output ONLY a JSON array of translated strings, in the same order "
    "and with the same length as the input. No commentary, no markdown "
    "code fences, no extra keys, no trailing text.\n"
    "5. If a string is already in the target language or has nothing to "
    "translate (a number, a symbol, a single proper noun), return it "
    "unchanged at the same array position.\n"
)


class GroqError(RuntimeError):
    """Raised when Groq returns an unrecoverable error."""


class Translator:
    """Concurrency-limited, retry-aware Groq translator."""

    def __init__(self) -> None:
        self.api_key = os.environ.get("GROQ_API_KEY", "")
        self.model = _env("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.temperature = float(_env("GROQ_TEMPERATURE", "0.2"))
        max_conc = int(_env("GROQ_MAX_CONCURRENCY", "4"))

        if not self.api_key:
            # Don't crash on import -- the /health route still needs to work
            # so the user can see the helpful error message.
            logger.warning(
                "GROQ_API_KEY is not set; /translate calls will fail until "
                "you create a .env file with your key."
            )

        self._client = httpx.AsyncClient(
            base_url=GROQ_BASE,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(45.0, connect=10.0),
        )
        self._sem = asyncio.Semaphore(max_conc)

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def translate_one(self, text: str, target_lang: str) -> str:
        """Translate a single string. Empty input returns empty output."""
        if not self.configured:
            raise GroqError(
                "GROQ_API_KEY is not configured on the server. "
                "Create translate-api/.env from .env.example."
            )
        if not text or not text.strip():
            return text

        body = {
            "model": self.model,
            "temperature": self.temperature,
            "messages": [
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT.format(
                        language=language_label(target_lang)
                    ),
                },
                {"role": "user", "content": text},
            ],
        }

        async with self._sem:
            last_err: Exception | None = None
            for attempt in range(3):
                try:
                    r = await self._client.post("/chat/completions", json=body)
                    if r.status_code == 429:
                        # Respect Retry-After if provided, else back off.
                        delay = float(r.headers.get("retry-after", 1 + attempt))
                        logger.info("Groq 429, sleeping %.1fs", delay)
                        await asyncio.sleep(delay)
                        continue
                    r.raise_for_status()
                    data = r.json()
                    return _extract_text(data)
                except (httpx.HTTPError, ValueError) as e:
                    last_err = e
                    logger.warning(
                        "Groq attempt %d/3 failed: %s", attempt + 1, e
                    )
                    await asyncio.sleep(0.5 * (attempt + 1))
            raise GroqError(f"Groq translation failed: {last_err}")

    async def translate_many(
        self,
        texts: list[str],
        target_lang: str,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> list[str]:
        """Translate many strings, batched into a small number of Groq calls.

        Strings are chunked into groups of `batch_size`. Each chunk goes to
        Groq as a single JSON-array prompt. If a chunk fails to parse or
        comes back the wrong length, we fall back to per-string translation
        for *that chunk only*.
        """
        if not texts:
            return []
        if not self.configured:
            raise GroqError(
                "GROQ_API_KEY is not configured on the server. "
                "Create translate-api/.env from .env.example."
            )

        chunks: list[list[str]] = [
            texts[i : i + batch_size] for i in range(0, len(texts), batch_size)
        ]

        # Chunks run in parallel, bounded by the semaphore. With concurrency=4
        # and batch_size=20, 100 strings = 5 chunks = ~1-2 Groq waves.
        results: list[list[str]] = await asyncio.gather(
            *(self._translate_chunk(c, target_lang) for c in chunks)
        )

        out: list[str] = []
        for chunk in results:
            out.extend(chunk)
        return out

    async def _translate_chunk(
        self, chunk: list[str], target_lang: str
    ) -> list[str]:
        """Translate one chunk in a single Groq call, falling back per-item."""
        body = {
            "model": self.model,
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": BATCH_SYSTEM_PROMPT.format(
                        language=language_label(target_lang)
                    ),
                },
                # Wrap the array in an object because Groq's json_object mode
                # requires a top-level JSON object, not an array.
                {
                    "role": "user",
                    "content": json.dumps({"items": chunk}, ensure_ascii=False),
                },
            ],
        }

        async with self._sem:
            last_err: Exception | None = None
            for attempt in range(3):
                try:
                    r = await self._client.post("/chat/completions", json=body)
                    if r.status_code == 429:
                        delay = float(r.headers.get("retry-after", 1 + attempt))
                        logger.info(
                            "Groq 429 (batch=%d), sleeping %.1fs",
                            len(chunk),
                            delay,
                        )
                        await asyncio.sleep(delay)
                        continue
                    r.raise_for_status()
                    raw = _extract_text(r.json())
                    parsed = _parse_batch_response(raw, len(chunk))
                    if parsed is not None:
                        return parsed
                    logger.warning(
                        "Batch parse failed (attempt %d/3); raw=%s",
                        attempt + 1,
                        raw[:200],
                    )
                except (httpx.HTTPError, ValueError) as e:
                    last_err = e
                    logger.warning(
                        "Groq batch attempt %d/3 failed: %s", attempt + 1, e
                    )
                await asyncio.sleep(0.5 * (attempt + 1))

        # All batch attempts failed -> fall back to per-item.
        logger.warning(
            "Batch giving up (last_err=%s); falling back to per-item for %d strings",
            last_err,
            len(chunk),
        )
        # Release the semaphore by exiting the `async with` block before
        # making N more sem-bound calls. (We're already outside it here.)
        per_item = await asyncio.gather(
            *(self.translate_one(t, target_lang) for t in chunk),
            return_exceptions=True,
        )
        # If any per-item still failed, keep the source text rather than blowing up.
        return [
            t if isinstance(t, str) else src
            for t, src in zip(per_item, chunk)
        ]


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _parse_batch_response(raw: str, expected_len: int) -> list[str] | None:
    """Parse Groq's batch reply into a list of strings.

    Returns `None` if parsing fails or the length doesn't match, so the
    caller can retry / fall back. Accepts:
      * `{"items": [...]}` (our preferred shape)
      * a bare JSON array `[...]`
      * either of the above wrapped in ```json fences
    """
    if not raw:
        return None
    cleaned = _FENCE_RE.sub("", raw.strip()).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract the first balanced [...] or {...} span.
        match = re.search(r"[\[{].*[\]}]", cleaned, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

    items: list = []
    if isinstance(data, dict):
        for key in ("items", "translations", "result", "results"):
            if key in data and isinstance(data[key], list):
                items = data[key]
                break
        else:
            # Object with no recognised key -> treat values as the array.
            if all(isinstance(v, str) for v in data.values()):
                items = list(data.values())
    elif isinstance(data, list):
        items = data

    if len(items) != expected_len:
        return None
    if not all(isinstance(x, str) for x in items):
        return None
    return items


def _extract_text(data: dict) -> str:
    """Pull the assistant message content out of a chat-completion response."""
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, AttributeError) as e:
        raise GroqError(f"Unexpected Groq response shape: {data!r}") from e
