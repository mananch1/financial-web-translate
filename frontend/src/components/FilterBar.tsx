"use client";

import { useState } from "react";

import { useT } from "@/lib/LangProvider";
import type { TabDef } from "@/lib/types";

export interface FilterValues {
  symbol: string;
  subject: string;
  searchBy: "All" | "Company" | "Symbol";
  foSec: boolean;
  trustee: string;
  isin: string;
  period: "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "Custom";
  from: string; // dd-mm-yyyy
  to: string;   // dd-mm-yyyy
  xbrl: boolean;
}

interface Props {
  tab: TabDef;
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  onSubmit: () => void;
  onReset: () => void;
}

const PERIODS: FilterValues["period"][] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "1Y",
  "Custom",
];

// Tiny date input that displays in the dd-mm-yyyy format NSE expects.
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // store dd-mm-yyyy in state, but render via <input type="date"> using yyyy-mm-dd
  const toIso = (v: string) => {
    if (!v || v.length !== 10) return "";
    const [d, m, y] = v.split("-");
    return `${y}-${m}-${d}`;
  };
  const fromIso = (v: string) => {
    if (!v) return "";
    const [y, m, d] = v.split("-");
    return `${d}-${m}-${y}`;
  };
  return (
    <label className="flex flex-col gap-1 text-[11px] text-[var(--nse-muted)]">
      <span>{label}</span>
      <input
        type="date"
        value={toIso(value)}
        onChange={(e) => onChange(fromIso(e.target.value))}
        className="h-8 px-2 border border-[var(--nse-border-strong)] rounded-sm bg-white text-[12px] text-[var(--nse-fg)] outline-none focus:border-[var(--nse-link)]"
      />
    </label>
  );
}

export default function FilterBar({
  tab,
  values,
  onChange,
  onSubmit,
  onReset,
}: Props) {
  const t = useT();
  const [sectionXBRL, setSectionXBRL] = useState(false);

  const set = <K extends keyof FilterValues>(k: K, v: FilterValues[K]) =>
    onChange({ ...values, [k]: v });

  return (
    <section
      className="bg-white px-5 py-5"
      role="tabpanel"
    >
      {tab.hasXBRL && (
        <div className="flex items-center gap-6 mb-5 border-b border-[var(--nse-border)] pb-3 text-[12px]">
          <button
            type="button"
            onClick={() => {
              setSectionXBRL(false);
              set("xbrl", false);
            }}
            className={`pb-1 font-semibold ${
              !sectionXBRL
                ? "text-[var(--nse-navy)] border-b-2 border-[var(--nse-orange)]"
                : "text-[var(--nse-muted)]"
            }`}
          >
            {t("Announcements")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSectionXBRL(true);
              set("xbrl", true);
            }}
            className={`pb-1 font-semibold ${
              sectionXBRL
                ? "text-[var(--nse-navy)] border-b-2 border-[var(--nse-orange)]"
                : "text-[var(--nse-muted)]"
            }`}
          >
            {t("Announcements XBRL")}
          </button>
          <a
            href="#"
            className="ml-auto text-[var(--nse-link)] hover:underline"
          >
            {t("Convert XBRL into Excel")}
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        {/* Symbol / company */}
        <label className="md:col-span-3 flex flex-col gap-1 text-[11px] text-[var(--nse-muted)]">
          <span>{t("Company")}</span>
          <input
            type="text"
            value={values.symbol}
            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
            placeholder={t("Type symbol or company")}
            className="h-8 px-2 border border-[var(--nse-border-strong)] rounded-sm bg-white text-[12px] text-[var(--nse-fg)] outline-none focus:border-[var(--nse-link)]"
          />
        </label>

        {/* Subject */}
        <label className="md:col-span-3 flex flex-col gap-1 text-[11px] text-[var(--nse-muted)]">
          <span>{t("Subject")}</span>
          <input
            type="text"
            value={values.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder={t("e.g. Board Meeting, Dividend")}
            className="h-8 px-2 border border-[var(--nse-border-strong)] rounded-sm bg-white text-[12px] text-[var(--nse-fg)] outline-none focus:border-[var(--nse-link)]"
          />
        </label>

        {/* DT-only: Debenture Trustee */}
        {tab.hasTrustee && (
          <label className="md:col-span-2 flex flex-col gap-1 text-[11px] text-[var(--nse-muted)]">
            <span>{t("Debenture Trustee")}</span>
            <input
              type="text"
              value={values.trustee}
              onChange={(e) => set("trustee", e.target.value)}
              className="h-8 px-2 border border-[var(--nse-border-strong)] rounded-sm bg-white text-[12px] text-[var(--nse-fg)] outline-none focus:border-[var(--nse-link)]"
            />
          </label>
        )}

        {/* DT-only: ISIN */}
        {tab.hasISIN && (
          <label className="md:col-span-2 flex flex-col gap-1 text-[11px] text-[var(--nse-muted)]">
            <span>{t("ISIN")}</span>
            <input
              type="text"
              value={values.isin}
              onChange={(e) => set("isin", e.target.value.toUpperCase())}
              className="h-8 px-2 border border-[var(--nse-border-strong)] rounded-sm bg-white text-[12px] text-[var(--nse-fg)] outline-none focus:border-[var(--nse-link)]"
            />
          </label>
        )}

        {/* Equity-only: Search By + F&O securities */}
        {!tab.hasTrustee && (
          <label className="md:col-span-2 flex flex-col gap-1 text-[11px] text-[var(--nse-muted)]">
            <span>{t("Search By")}</span>
            <select
              value={values.searchBy}
              onChange={(e) =>
                set("searchBy", e.target.value as FilterValues["searchBy"])
              }
              className="h-8 px-2 border border-[var(--nse-border-strong)] rounded-sm bg-white text-[12px] text-[var(--nse-fg)] outline-none focus:border-[var(--nse-link)]"
            >
              <option value="All">{t("All")}</option>
              <option value="Company">{t("Company")}</option>
              <option value="Symbol">{t("Symbol")}</option>
            </select>
          </label>
        )}
        {tab.hasFO && (
          <label className="md:col-span-2 flex items-center gap-2 mt-5 text-[12px] text-[var(--nse-fg)]">
            <input
              type="checkbox"
              checked={values.foSec}
              onChange={(e) => set("foSec", e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--nse-link)]"
            />
            {t("Select F&O Securities")}
          </label>
        )}

        {/* Period chooser */}
        <div className="md:col-span-12 flex flex-wrap items-end gap-3 pt-1">
          <div className="flex flex-col gap-1 text-[11px] text-[var(--nse-muted)]">
            <span>{t("Select Date Period")}</span>
            <div className="flex items-center gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("period", p)}
                  className={`h-7 px-2 text-[11px] border rounded-sm ${
                    values.period === p
                      ? "bg-[var(--nse-navy)] text-white border-[var(--nse-navy)]"
                      : "bg-white text-[var(--nse-fg)] border-[var(--nse-border-strong)] hover:border-[var(--nse-navy)]"
                  }`}
                >
                  {p === "Custom" ? t("Custom") : p}
                </button>
              ))}
            </div>
          </div>

          <DateField
            label={t("From")}
            value={values.from}
            onChange={(v) => set("from", v)}
          />
          <DateField
            label={t("To")}
            value={values.to}
            onChange={(v) => set("to", v)}
          />

          <button
            type="button"
            onClick={onSubmit}
            className="h-8 px-5 rounded-sm bg-[var(--nse-orange)] text-white text-[12px] font-bold tracking-wider hover:brightness-95"
          >
            {t("GO")}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="h-8 px-3 rounded-sm border border-[var(--nse-border-strong)] text-[12px] text-[var(--nse-muted)] hover:text-[var(--nse-fg)]"
          >
            {t("Reset")}
          </button>
        </div>
      </div>
    </section>
  );
}
