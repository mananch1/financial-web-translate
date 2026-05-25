import type {
  AnnouncementsResponse,
  AutocompleteResponse,
  MarketSnapshot,
  TabId,
} from "./types";

const BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export interface AnnouncementsQuery {
  index: TabId;
  from?: string;     // dd-mm-yyyy
  to?: string;       // dd-mm-yyyy
  symbol?: string;
  subject?: string;
  fo_sec?: boolean;
  xbrl?: boolean;
  /** Target language code passed to backend, e.g. "hi". "en" or
   *  undefined skips server-side translation. */
  lang?: string;
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.append(k, String(v));
  }
  return u.toString();
}

export async function fetchAnnouncements(
  q: AnnouncementsQuery,
  signal?: AbortSignal,
): Promise<AnnouncementsResponse> {
  const path = q.xbrl ? "/api/announcements/xbrl" : "/api/announcements";
  const { xbrl: _xbrl, ...rest } = q;
  void _xbrl;
  // `lang` is forwarded as a real query param so the backend can do
  // ES-cached, eager translation. Client-side row translation is gone.
  const url = `${BASE}${path}?${qs(rest)}`;
  const r = await fetch(url, { signal, cache: "no-store" });
  if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
  return (await r.json()) as AnnouncementsResponse;
}

export async function fetchMarketSnapshot(
  signal?: AbortSignal,
): Promise<MarketSnapshot> {
  const r = await fetch(`${BASE}/api/market-snapshot`, {
    signal,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
  return (await r.json()) as MarketSnapshot;
}

export async function fetchAutocomplete(
  q: string,
  signal?: AbortSignal,
): Promise<AutocompleteResponse> {
  const r = await fetch(`${BASE}/api/autocomplete?q=${encodeURIComponent(q)}`, {
    signal,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
  return (await r.json()) as AutocompleteResponse;
}
