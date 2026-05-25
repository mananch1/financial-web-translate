"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AnnouncementsTable from "@/components/AnnouncementsTable";
import Breadcrumb from "@/components/Breadcrumb";
import FilterBar, { type FilterValues } from "@/components/FilterBar";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import MarketTicker from "@/components/MarketTicker";
import TabStrip from "@/components/TabStrip";
import TopUtilityBar from "@/components/TopUtilityBar";

import { fetchAnnouncements } from "@/lib/api";
import { useLang } from "@/lib/LangProvider";
import { TABS, type Announcement, type TabId } from "@/lib/types";

function toApiDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function defaultFilters(): FilterValues {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 1);
  return {
    symbol: "",
    subject: "",
    searchBy: "All",
    foSec: false,
    trustee: "",
    isin: "",
    period: "1D",
    from: toApiDate(from),
    to: toApiDate(to),
    xbrl: false,
  };
}

export default function Page() {
  const { lang, t } = useLang();
  const [tab, setTab] = useState<TabId>("equities");
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const tabDef = useMemo(() => TABS.find((tb) => tb.id === tab)!, [tab]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        // Backend caps to the top 50 rows and eagerly translates the
        // prose fields (desc, attchmntText, smIndustry) to `lang`,
        // caching the result in Elasticsearch by row id.
        const res = await fetchAnnouncements(
          {
            index: tab,
            from: filters.from || undefined,
            to: filters.to || undefined,
            symbol: filters.symbol || undefined,
            subject: filters.subject || undefined,
            fo_sec: filters.foSec,
            xbrl: filters.xbrl,
            lang,
          },
          signal,
        );
        setRows(res.rows ?? []);
        setLastRefreshed(new Date());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(
          t("Could not reach NSE. The backend may be warming up — please try again."),
        );
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [
      tab,
      filters.from,
      filters.to,
      filters.symbol,
      filters.subject,
      filters.foSec,
      filters.xbrl,
      lang,
      t,
    ],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filters.xbrl, lang]);

  return (
    <>
      <TopUtilityBar />
      <Header />
      <MarketTicker />

      <Breadcrumb
        items={[
          { label: "Home", href: "#" },
          { label: "Companies & Listing", href: "#" },
          { label: "Corporate Filings", href: "#" },
          { label: "Announcements" },
        ]}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-[1280px] px-4 py-5">
          {/* Page title row */}
          <div className="flex items-end justify-between mb-4">
            <h1 className="nse-page-title text-[22px] font-bold text-[var(--nse-navy)] tracking-tight">
              {t("Announcements")}
            </h1>
            <div className="text-[11px] text-[var(--nse-muted)] flex items-center gap-3">
              {lastRefreshed && (
                <span>
                  {t("Last refreshed:")}{" "}
                  <span className="font-medium text-[var(--nse-fg)]">
                    {lastRefreshed.toLocaleString("en-IN")}
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="h-7 px-3 text-[11px] font-semibold rounded-sm border border-[var(--nse-border-strong)] text-[var(--nse-navy)] hover:bg-white disabled:opacity-50"
              >
                {loading ? t("Refreshing…") : `↻ ${t("Refresh")}`}
              </button>
            </div>
          </div>

          {/* Tab + filter card */}
          <div className="bg-white rounded-sm shadow-sm border border-[var(--nse-border-strong)] overflow-hidden">
            <TabStrip active={tab} onChange={setTab} />
            <FilterBar
              tab={tabDef}
              values={filters}
              onChange={setFilters}
              onSubmit={() => void load()}
              onReset={() => {
                setFilters(defaultFilters());
                void load();
              }}
            />
          </div>

          {/* Results table */}
          <div className="mt-4">
            <AnnouncementsTable rows={rows} loading={loading} error={error} />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
