# Translate API

A small FastAPI microservice that translates batches of English strings into
any of the Indian languages NSE supports, powered by a **Groq** LLM
(default: `llama-3.3-70b-versatile`) with a **SQLite MD5 cache** so the same
sentence is never sent to Groq twice.

```
translate-api/
├── main.py            FastAPI routes (/translate, /health, /languages, /cache/clear)
├── translator.py      Groq client (async, concurrency-limited, retry on 429)
├── cache.py           SQLite cache, keyed by MD5(lang :: source)
├── requirements.txt
├── .env.example       Copy to .env and fill GROQ_API_KEY
└── translation_cache.sqlite   Auto-created at runtime (git-ignored)
```

---

## Setup (Windows / PowerShell)

```powershell
cd translate-api
python -m pip install -r requirements.txt

# Create your env file from the template, then paste your Groq key
Copy-Item .env.example .env
notepad .env
```

`.env` should contain at minimum:

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Optional overrides:

| Variable               | Default                       | Notes                                  |
| ---------------------- | ----------------------------- | -------------------------------------- |
| `GROQ_MODEL`           | `llama-3.3-70b-versatile`     | Any chat model on Groq                 |
| `GROQ_MAX_CONCURRENCY` | `4`                           | Parallel in-flight requests to Groq    |
| `GROQ_TEMPERATURE`     | `0.2`                         | Lower = more literal translation       |
| `TRANSLATE_PORT`       | `8100`                        | Server port                            |

---

## Run

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8100 --reload
```

Server URL: **http://127.0.0.1:8100**

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8100/health
# -> { ok: True, model: 'llama-3.3-70b-versatile', configured: True, cache_size: 0 }
```

---

## API

### `POST /translate`

```json
{
  "language": "hi",
  "texts": [
    "Board Meeting",
    "Outcome of Board Meeting held on 22-May-2026",
    "RELIANCE has declared an interim dividend"
  ]
}
```

Response:

```json
{
  "language": "hi",
  "languageLabel": "Hindi (हिन्दी, Devanagari script)",
  "model": "llama-3.3-70b-versatile",
  "translations": ["...", "...", "..."],
  "cached":       [false, false, false],
  "cacheHits": 0,
  "cacheMisses": 3
}
```

Call it again with the same payload and you'll see `cacheHits: 3`,
`cacheMisses: 0` — the Groq API is not touched.

### Supported language tags

`hi`, `mr`, `gu`, `bn`, `kn`, `ta`, `te`, `pa`, `ml`, `or`, `as`, `ur`, `en`
(same set NSE shows in their top-right language picker).
Full list: **`GET /languages`**.

### Cache helpers

- `GET /health` — shows current cache size.
- `POST /cache/clear` — empties the SQLite table.

---

## How the prompt is wired

The system prompt is fixed inside `translator.py` and enforces:

1. Formal register suitable for an official NSE disclosure.
2. **ALL CAPS tokens stay ALL CAPS** (NSE, BSE, IPO, NIFTY, ISIN, AGM, ...).
3. Numbers, dates, percentages, ISINs, tickers and proper nouns are
   preserved verbatim.
4. Output is **only** the translation — no quotes, no `Translation:`
   prefix, no commentary.

Each text in the batch is sent as its own chat completion (parallel,
bounded by `GROQ_MAX_CONCURRENCY`). One-text-per-call is more reliable
than asking the model to translate a numbered list and then having to
parse it back.

---

## Cache details

- Table: `translations(hash PRIMARY KEY, lang, source, translation, model, created_at)`
- Key: `md5(lang.lower() + "::" + source_text)` — see `cache_key()` in `cache.py`
- Storage: `translation_cache.sqlite` in this folder (WAL mode for concurrent reads)
- Inspect:

  ```powershell
  python -c "from cache import TranslationCache; c = TranslationCache(); print('rows:', c.size())"
  ```

To wipe everything: `POST /cache/clear` or just delete the `.sqlite` file.
