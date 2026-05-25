// Translation helpers: dictionary loader for static chrome strings,
// and a row-translator that walks JSON responses from the NSE backend
// and replaces allowlisted fields with translations.

import { UI_STRINGS } from "./strings";

const TRANSLATE_API =
  process.env.NEXT_PUBLIC_TRANSLATE_API ?? "http://127.0.0.1:8100";

export type Dictionary = Record<string, string>;

interface TranslateResponse {
  language: string;
  translations: string[];
  cached: boolean[];
  cacheHits: number;
  cacheMisses: number;
}

// One in-flight promise per language so concurrent callers share work.
const inflight = new Map<string, Promise<Dictionary>>();
// Persistent in-memory cache. Cleared only on full reload.
const dictCache = new Map<string, Dictionary>();

// ---------------------------------------------------------------------------
// Static chrome dictionary
// ---------------------------------------------------------------------------

/**
 * Load the full UI dictionary for `lang`. English short-circuits to identity.
 *
 * On translate-api failure we silently return the English identity dictionary
 * so the page never breaks — the user sees English instead of broken Hindi.
 */
export async function loadDictionary(
  lang: string,
  signal?: AbortSignal,
): Promise<Dictionary> {
  if (lang === "en") return identityDict();
  if (dictCache.has(lang)) return dictCache.get(lang)!;
  if (inflight.has(lang)) return inflight.get(lang)!;

  const p = (async (): Promise<Dictionary> => {
    try {
      const r = await fetch(`${TRANSLATE_API}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          texts: UI_STRINGS as readonly string[],
        }),
        signal,
      });
      if (!r.ok) throw new Error(`translate-api ${r.status}`);
      const data = (await r.json()) as TranslateResponse;
      const dict: Dictionary = {};
      UI_STRINGS.forEach((src, i) => {
        dict[src] = data.translations[i] ?? src;
      });
      dictCache.set(lang, dict);
      return dict;
    } catch {
      // Silent fallback to English. Demo never crashes if translate-api is down.
      return identityDict();
    } finally {
      inflight.delete(lang);
    }
  })();

  inflight.set(lang, p);
  return p;
}

function identityDict(): Dictionary {
  const d: Dictionary = {};
  for (const s of UI_STRINGS) d[s] = s;
  return d;
}

// ---------------------------------------------------------------------------
// Live-data row translator
// ---------------------------------------------------------------------------

// Fields on an Announcement that contain prose worth translating.
// Symbols, ISINs, attachment URLs, dates, numbers etc. are deliberately
// excluded — they should be displayed verbatim regardless of language.
const TRANSLATABLE_FIELDS = [
  "desc",
  "attchmntText",
  "smIndustry",
] as const;

type Row = Record<string, unknown>;

/**
 * Translate `desc` / `attchmntText` / `smIndustry` on every row in `rows`.
 * Dedupes strings before calling the API (a page of 100 announcements often
 * shares ~8 unique subjects). Mutates the row objects in place AND returns
 * the same array for chaining.
 */
export async function translateRows<T extends Row>(
  rows: T[],
  lang: string,
  signal?: AbortSignal,
): Promise<T[]> {
  if (lang === "en" || rows.length === 0) return rows;

  const unique = new Set<string>();
  for (const r of rows) {
    for (const f of TRANSLATABLE_FIELDS) {
      const v = r[f];
      if (typeof v === "string" && v.trim()) unique.add(v);
    }
  }
  if (unique.size === 0) return rows;

  const texts = Array.from(unique);
  let map: Map<string, string>;
  try {
    const r = await fetch(`${TRANSLATE_API}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang, texts }),
      signal,
    });
    if (!r.ok) throw new Error(`translate-api ${r.status}`);
    const data = (await r.json()) as TranslateResponse;
    map = new Map(texts.map((src, i) => [src, data.translations[i] ?? src]));
  } catch {
    // Silent EN fallback — caller still gets the original rows.
    return rows;
  }

  for (const r of rows) {
    for (const f of TRANSLATABLE_FIELDS) {
      const v = r[f];
      if (typeof v === "string" && map.has(v)) {
        (r as Row)[f] = map.get(v)!;
      }
    }
  }
  return rows;
}
