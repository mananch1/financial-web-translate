"use client";

import { useMemo, useState } from "react";

import { useT } from "@/lib/LangProvider";
import type { Announcement } from "@/lib/types";

interface Props {
  rows: Announcement[];
  loading: boolean;
  error?: string | null;
}

type SortKey = "symbol" | "desc" | "an_dt" | "exchdisstime" | "difference";

function formatDate(s?: string | null): string {
  if (!s) return "—";
  return s.replace(/\s+/g, " ").trim();
}

function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#c8102e"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      />
      <path fill="#fff" d="M14 2v6h6" opacity=".4" />
      <text
        x="12"
        y="18"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        fill="#fff"
      >
        PDF
      </text>
    </svg>
  );
}

function XbrlIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#1d2a5a" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        fill="#fff"
      >
        XBRL
      </text>
    </svg>
  );
}

export default function AnnouncementsTable({ rows, loading, error }: Props) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("an_dt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.symbol, r.sm_name, r.desc, r.attchmntText, r.smIndustry]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      const r = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? r : -r;
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const slice = sorted.slice(start, start + perPage);

  const headerCell = (key: SortKey, label: string, extra = "") => {
    const on = sortKey === key;
    return (
      <th
        scope="col"
        className={`px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-[10.5px] cursor-pointer select-none whitespace-nowrap ${extra}`}
        onClick={() => {
          if (on) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setSortKey(key);
            setSortDir("desc");
          }
        }}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="opacity-60 text-[9px]">
            {on ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </span>
      </th>
    );
  };

  const plainHeader = (label: string, extra = "") => (
    <th
      scope="col"
      className={`px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-[10.5px] whitespace-nowrap ${extra}`}
    >
      {label}
    </th>
  );

  function downloadCsv() {
    const cols = [
      "Symbol",
      "Company Name",
      "Industry",
      "Subject",
      "Details",
      "Broadcast Date/Time",
      "Receipt Date/Time",
      "Difference",
      "Attachment",
    ];
    const rowsCsv = sorted.map((r) => [
      r.symbol ?? "",
      r.sm_name ?? "",
      r.smIndustry ?? "",
      r.desc ?? "",
      (r.attchmntText ?? "").replace(/\s+/g, " "),
      r.an_dt ?? "",
      r.exchdisstime ?? "",
      r.difference ?? "",
      r.attchmntFile ?? "",
    ]);
    const csv = [cols, ...rowsCsv]
      .map((line) =>
        line
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nse-announcements.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white border border-[var(--nse-border-strong)] shadow-sm">
      {/* Table toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-[var(--nse-border)] bg-[var(--nse-page)]/50">
        <div className="text-[11.5px] text-[var(--nse-muted)] flex items-center gap-1">
          {t("Show")}
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="mx-1 h-7 px-1 border border-[var(--nse-border-strong)] rounded-sm bg-white text-[12px] text-[var(--nse-fg)]"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {t("entries")}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="text-[11.5px] text-[var(--nse-muted)] flex items-center gap-2">
            {t("Search:")}
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-7 px-2 border border-[var(--nse-border-strong)] rounded-sm bg-white text-[12px] text-[var(--nse-fg)] outline-none focus:border-[var(--nse-link)] w-44"
            />
          </label>
          <button
            type="button"
            onClick={downloadCsv}
            className="h-7 px-3 text-[11.5px] font-semibold rounded-sm border border-[var(--nse-border-strong)] text-[var(--nse-navy)] hover:bg-white inline-flex items-center gap-1"
          >
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
              <path
                fill="currentColor"
                d="M8 1v8m0 0l3-3m-3 3L5 6m-3 7v1h12v-1"
                stroke="currentColor"
                strokeWidth="1.5"
                fillOpacity="0"
              />
            </svg>
            {t("Download CSV")}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] border-collapse">
          <thead className="bg-[var(--nse-navy)] text-white">
            <tr>
              {headerCell("symbol", t("Symbol"))}
              {plainHeader(t("Company Name"))}
              {plainHeader(t("Industry"))}
              {headerCell("desc", t("Subject"))}
              {plainHeader(t("Details"), "min-w-[280px]")}
              {headerCell("an_dt", t("Broadcast Date/Time"))}
              {headerCell("exchdisstime", t("Receipt Date/Time"))}
              {headerCell("difference", t("Difference"))}
              {plainHeader(t("Attachment"))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-12 text-center text-[var(--nse-muted)]"
                >
                  {t("Loading announcements…")}
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-12 text-center text-[var(--nse-red)]"
                >
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && slice.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-12 text-center text-[var(--nse-muted)]"
                >
                  {t("No announcements found for the selected filters.")}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              slice.map((r, i) => (
                <tr
                  key={r.seq_id ?? `${r.symbol}-${i}`}
                  className={`${
                    i % 2 ? "bg-[#fafbfd]" : "bg-white"
                  } hover:bg-[#eef3fa] transition-colors`}
                >
                  <td className="px-3 py-2 align-top font-bold text-[var(--nse-link)] border-b border-[var(--nse-border)] whitespace-nowrap">
                    <a
                      href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(
                        r.symbol ?? "",
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {r.symbol ?? "—"}
                    </a>
                  </td>
                  <td className="px-3 py-2 align-top border-b border-[var(--nse-border)] min-w-[180px]">
                    {r.sm_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-top border-b border-[var(--nse-border)] text-[var(--nse-muted)] min-w-[140px]">
                    {r.smIndustry ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-top border-b border-[var(--nse-border)] font-semibold text-[var(--nse-navy)] min-w-[180px]">
                    {r.desc ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-top border-b border-[var(--nse-border)] text-[var(--nse-muted)]">
                    <div className="max-w-[420px] line-clamp-3 leading-snug">
                      {r.attchmntText ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top border-b border-[var(--nse-border)] whitespace-nowrap tabular-nums text-[11px]">
                    {formatDate(r.an_dt)}
                  </td>
                  <td className="px-3 py-2 align-top border-b border-[var(--nse-border)] whitespace-nowrap tabular-nums text-[11px]">
                    {formatDate(r.exchdisstime)}
                  </td>
                  <td className="px-3 py-2 align-top border-b border-[var(--nse-border)] whitespace-nowrap tabular-nums text-[11px] text-[var(--nse-muted)]">
                    {r.difference ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-top border-b border-[var(--nse-border)] whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {r.attchmntFile && (
                        <a
                          href={r.attchmntFile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--nse-link)] hover:underline"
                          title={r.fileSize ?? ""}
                        >
                          <PdfIcon />
                          <span className="text-[10.5px] text-[var(--nse-muted)]">
                            {r.fileSize ?? "PDF"}
                          </span>
                        </a>
                      )}
                      {r.hasXbrl && (
                        <a
                          href="#"
                          className="inline-flex items-center gap-1 text-[var(--nse-link)] hover:underline"
                          title="XBRL document"
                        >
                          <XbrlIcon />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      {!loading && !error && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[var(--nse-border)] text-[12px] text-[var(--nse-muted)]">
          <div>
            {t("Show")} {start + 1} {t("to")}{" "}
            {Math.min(start + perPage, total)} {t("of")} {total}{" "}
            {t("entries")}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 px-3 border border-[var(--nse-border-strong)] rounded-sm disabled:opacity-40 hover:bg-[var(--nse-page)]"
            >
              {t("Previous")}
            </button>
            {Array.from({ length: pages }).slice(0, 7).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`h-7 min-w-7 px-2 border rounded-sm ${
                    p === safePage
                      ? "bg-[var(--nse-navy)] text-white border-[var(--nse-navy)]"
                      : "border-[var(--nse-border-strong)] hover:bg-[var(--nse-page)]"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            {pages > 7 && <span className="px-2">…</span>}
            <button
              type="button"
              disabled={safePage >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-3 border border-[var(--nse-border-strong)] rounded-sm disabled:opacity-40 hover:bg-[var(--nse-page)]"
            >
              {t("Next")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
