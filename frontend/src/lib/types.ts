// Shape of a single announcement row returned by our backend
// (which mirrors the upstream NSE response).
export interface Announcement {
  symbol?: string | null;
  sm_name?: string | null;
  sm_isin?: string | null;
  smIndustry?: string | null;
  desc?: string | null;
  attchmntText?: string | null;
  attchmntFile?: string | null;
  an_dt?: string | null;
  sort_date?: string | null;
  exchdisstime?: string | null;
  difference?: string | null;
  seq_id?: string | null;
  fileSize?: string | null;
  attFileSize?: string | null;
  hasXbrl?: boolean | null;
  csvName?: string | null;
  // catch-all so we can render unknown extra fields without TS errors
  [key: string]: unknown;
}

export interface AnnouncementsResponse {
  index: string;
  count: number;
  rows: Announcement[];
}

export interface MarketSnapshot {
  nifty50: {
    last: number | null;
    change: number | null;
    percentChange: number | null;
    status?: string | null;
    statusMessage?: string | null;
    asOf: string | null;
  };
  futures: {
    symbol?: string | null;
    expiry?: string | null;
    last: number | null;
    change: number | null;
    percentChange: number | null;
    asOf: string | null;
  };
  usdinr: {
    last: number | null;
    expiry?: string | null;
    asOf: string | null;
  };
  marketCap: {
    lacCrs: number | null;
    tnUSD: number | null;
    asOf: string | null;
  };
  marketStates?: Array<{
    market: string;
    status: string;
    message: string;
  }>;
}

export interface AutocompleteSymbol {
  symbol: string;
  name: string;
  type?: string | string[];
}

export interface AutocompleteResponse {
  q: string;
  symbols: AutocompleteSymbol[];
}

// IDs used by the tab strip; map 1:1 to the backend ?index= values.
export type TabId =
  | "votingresults"
  | "equities"
  | "sme"
  | "debt"
  | "mf"
  | "invitsreits"
  | "municipalbond"
  | "sse"
  | "dt";

export interface TabDef {
  id: TabId;
  label: string;
  hasFO?: boolean;       // shows "Select F&O Securities" toggle
  hasXBRL?: boolean;     // shows "Announcements / Announcements XBRL" sub-tabs
  hasTrustee?: boolean;  // shows "Debenture Trustee" filter
  hasISIN?: boolean;     // shows "ISIN" filter
}

export const TABS: TabDef[] = [
  { id: "votingresults", label: "Voting Results" },
  { id: "equities", label: "Equity", hasFO: true, hasXBRL: true },
  { id: "sme", label: "SME" },
  { id: "debt", label: "Debt", hasXBRL: true },
  { id: "mf", label: "MF", hasXBRL: true },
  { id: "invitsreits", label: "REIT/InvIT" },
  { id: "municipalbond", label: "Municipal Bond" },
  { id: "sse", label: "SSE" },
  { id: "dt", label: "DT Disclosures", hasTrustee: true, hasISIN: true },
];
