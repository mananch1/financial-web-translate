# NSE Corporate Filings Announcements — clone

A pixel-faithful clone of
[nseindia.com/companies-listing/corporate-filings-announcements](https://www.nseindia.com/companies-listing/corporate-filings-announcements)
built with:

| Layer    | Stack                                                          |
| -------- | -------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · React 19 |
| Backend  | Python 3.12 · FastAPI · httpx (async, cookie-aware NSE scraper) |

The backend serves as a thin, cookie-warming proxy on top of NSE's
(undocumented) JSON endpoints — the frontend never talks to nseindia.com
directly, so the browser is shielded from CORS and Akamai bot-management.

---

## Folder layout

```
Sarvam/
├── backend/                FastAPI app (the NSE scraper / proxy)
│   ├── main.py             REST surface (/api/announcements, …)
│   ├── nse_client.py       Async cookie-aware NSE client (warm-up + retry)
│   └── requirements.txt
└── frontend/               Next.js app (the UI clone)
    └── src/
        ├── app/            page.tsx · layout.tsx · globals.css
        ├── components/     TopUtilityBar, Header, NseLogo, MarketTicker,
        │                   TabStrip, FilterBar, AnnouncementsTable, Footer
        └── lib/            api.ts · types.ts
```

---

## Running locally (Windows / PowerShell)

### 1. Backend

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Smoke-test:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod 'http://127.0.0.1:8000/api/announcements?index=equities'
```

### 2. Frontend

```powershell
cd frontend
npm install      # only on first run
npm run dev      # http://localhost:3000
```

If your backend isn't on the default port, set the API base before
starting the frontend:

```powershell
$env:NEXT_PUBLIC_API_BASE = "http://127.0.0.1:9000"
npm run dev
```

---

## API surface (backend)

| Route                                    | What it returns                                 |
| ---------------------------------------- | ----------------------------------------------- |
| `GET /api/health`                        | `{ok: true}`                                    |
| `GET /api/market-snapshot`               | Live NIFTY 50, GIFT Nifty futures, USD/INR, market cap (from `/api/marketStatus`) |
| `GET /api/autocomplete?q=…`              | Company/symbol search suggestions               |
| `GET /api/announcements?index=…`         | Announcements for a tab                         |
| `GET /api/announcements/xbrl?index=…`    | XBRL variant of the same tab                    |

Valid `index` values: `equities`, `sme`, `debt`, `mf`, `invitsreits`,
`municipalbond`, `sse`, `dt`, `votingresults`.

Optional filters: `from`, `to` (`dd-mm-yyyy`), `symbol`, `subject`,
`fo_sec`.

---

## How the scraper works

NSE serves JSON only to clients that look like a real browser **and** carry
the session cookies set when you visit one of their HTML pages. `nse_client.py`:

1. Warms a long-lived `httpx.AsyncClient` by hitting a few HTML pages
   (`/`, `/companies-listing/...`, `/market-data/live-equity-market`).
2. Re-warms automatically when a request comes back as 403, HTML, or an
   error — cookies live for ~10 min on NSE.
3. Sets browser-ish headers (UA, Accept, Sec-Fetch-*) on every request.
4. Skips brotli in `Accept-Encoding` because we don't ship the brotli
   decoder.

---

## Limitations / notes

* Streaming market data is fetched every 30 s from NSE's `equity-stockIndices`
  endpoint; if NSE rate-limits, the UI falls back to the static values shown
  on the snapshot they served us during development.
* "Voting Results" and "DT Disclosures" tabs reuse the same scraper plumbing
  but the upstream NSE endpoints occasionally return different schemas;
  the frontend renders every row using the shared `Announcement` type and
  shows blanks for missing columns.
* This is a learning / demo project — do not use it for trading decisions.
  NSE is the authoritative source.
