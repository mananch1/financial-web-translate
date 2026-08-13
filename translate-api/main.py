"""Translate-API: small FastAPI service that wraps Groq for batch
English -> Indian-language translation, with a SQLite cache.

Endpoints
---------
GET  /health             -> {ok, model, configured, cache_size}
GET  /languages          -> list of supported language tags
POST /translate          -> body: {language, texts[]}; returns translations[]
POST /cache/clear        -> wipe the SQLite cache (debug helper)
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load .env BEFORE we import modules that read env vars.
load_dotenv()

from cache import TranslationCache  # noqa: E402
from translator import (  # noqa: E402
    LANGUAGE_NAMES,
    GroqError,
    Translator,
    language_label,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("translate-api")


# ----- app lifecycle --------------------------------------------------------

_translator: Translator | None = None
_cache: TranslationCache | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _translator, _cache
    _cache = TranslationCache()
    _translator = Translator()
    logger.info(
        "Translate-API ready (model=%s, configured=%s, cache_size=%d)",
        _translator.model,
        _translator.configured,
        _cache.size(),
    )
    yield
    await _translator.aclose()
    _cache.close()


app = FastAPI(
    title="NSE Translate API",
    version="0.1.0",
    description=(
        "English -> Indian-language translation for the NSE clone, "
        "powered by Groq with a SQLite MD5 cache."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ----- request / response models -------------------------------------------


class TranslateRequest(BaseModel):
    language: str = Field(
        ...,
        description="Target language tag, e.g. 'hi', 'mr', 'gu'.",
        examples=["hi"],
    )
    texts: list[str] = Field(
        ...,
        min_length=1,
        max_length=200,
        description="English strings to translate. Order is preserved.",
    )


class TranslateResponse(BaseModel):
    language: str
    languageLabel: str
    model: str
    translations: list[str]
    cached: list[bool]
    cacheHits: int
    cacheMisses: int


# ----- routes --------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, Any]:
    assert _translator is not None and _cache is not None
    return {
        "ok": True,
        "model": _translator.model,
        "configured": _translator.configured,
        "cache_size": _cache.size(),
    }


@app.get("/languages")
async def languages() -> dict[str, Any]:
    return {
        "languages": [
            {"tag": tag, "label": label} for tag, label in LANGUAGE_NAMES.items()
        ]
    }


@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    assert _translator is not None and _cache is not None

    lang = req.language.strip().lower()
    if not lang:
        raise HTTPException(400, "language is required")

    # 1. Cache lookup — one MD5 per text.
    cached_values: list[str | None] = _cache.get_many(req.texts, lang)
    cached_flags: list[bool] = [v is not None for v in cached_values]

    # Short-circuit: if target == source language, return as-is and warm cache
    # so future identity calls are free too.
    if lang == "en":
        return TranslateResponse(
            language=lang,
            languageLabel=language_label(lang),
            model=_translator.model,
            translations=list(req.texts),
            cached=cached_flags,
            cacheHits=sum(cached_flags),
            cacheMisses=0,
        )

    # 2. Translate the misses in batched Groq calls (one call per ~20 strings).
    miss_indices = [i for i, v in enumerate(cached_values) if v is None]
    if miss_indices:
        miss_texts = [req.texts[i] for i in miss_indices]
        try:
            new_translations = await _translator.translate_many(miss_texts, lang)
        except GroqError as e:
            raise HTTPException(502, str(e)) from e

        # 3. Persist to cache.
        _cache.put_many(
            [
                (req.texts[i], lang, t)
                for i, t in zip(miss_indices, new_translations)
            ],
            model=_translator.model,
        )

        for i, t in zip(miss_indices, new_translations):
            cached_values[i] = t

    return TranslateResponse(
        language=lang,
        languageLabel=language_label(lang),
        model=_translator.model,
        translations=[v or "" for v in cached_values],
        cached=cached_flags,
        cacheHits=sum(cached_flags),
        cacheMisses=len(miss_indices),
    )


@app.post("/cache/clear")
async def cache_clear() -> dict[str, Any]:
    assert _cache is not None
    before = _cache.size()
    _cache.clear()
    return {"cleared": before, "size": _cache.length()}


# ----- dev entry point ------------------------------------------------------

if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    port = int(os.environ.get("TRANSLATE_PORT", "8101"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
