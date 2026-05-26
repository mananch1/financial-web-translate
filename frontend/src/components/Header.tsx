"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { fetchAutocomplete } from "@/lib/api";
import { useLang, useT } from "@/lib/LangProvider";
import { withLang } from "@/lib/languages";
import type { AutocompleteSymbol } from "@/lib/types";
import NseLogo from "./NseLogo";

// Main navigation items shown on every NSE page. The "Companies Listing"
// item is highlighted because we're on a page under that section.
const NAV: { label: string; sub?: string[]; highlighted?: boolean }[] = [
  { label: "MARKET DATA", sub: ["Live Market", "Pre-Open Market", "After Market", "Most Active", "Top Gainers / Losers"] },
  { label: "MARKET INDICES", sub: ["NIFTY 50", "Broad Indices", "Sectoral Indices", "Thematic Indices", "Strategy Indices"] },
  { label: "MARKET TURNOVER" },
  { label: "PRODUCTS & SERVICES", sub: ["Equity", "Derivatives", "Currency", "Commodity", "Mutual Funds", "ETF"] },
  { label: "RESOURCES", sub: ["Reports", "Circulars", "Bye-Laws & Regulations", "Holiday Calendar", "Trading Calendar"] },
  {
    label: "COMPANIES LISTING",
    highlighted: true,
    sub: [
      "Corporate Filings",
      "Corporate Information",
      "Initial Public Offerings",
      "Listing on NSE",
      "Annual Reports",
      "Right Issues",
    ],
  },
  { label: "INVEST", sub: ["Mutual Funds", "Bonds", "ETFs", "Equity"] },
  { label: "REGULATIONS", sub: ["SEBI Regulations", "NSE Regulations", "Code of Conduct"] },
];

// "Login to" portals shown in the corner dropdown.
const LOGIN_PORTALS = [
  "Member Portal",
  "NEAPS Portal",
  "Investor Service Centre",
  "NSE NMF II",
  "NSE Pathshala",
];

interface SymbolHit extends AutocompleteSymbol {
  // type already optional on the base type
}

function Chevron({ open }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 12 8"
      width={10}
      height={7}
      className={`transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default function Header() {
  const t = useT();
  const { lang } = useLang();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SymbolHit[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strip any language prefix so we know which "real" route we're on.
  // /hindi/about -> /about, /market -> /market.
  const routePath = pathname.replace(/^\/[a-z]+/, (m) =>
    /^\/(hindi|marathi|gujarati|bengali|kannada|tamil|telugu|punjabi|malayalam|oriya|assamese|urdu)$/i.test(m)
      ? ""
      : m,
  ) || "/";
  const isAbout = routePath === "/about";
  const isMarket = !isAbout; // /, /market, /market/...

  useEffect(() => {
    if (!searchQ.trim()) {
      setSearchHits([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await fetchAutocomplete(searchQ);
        setSearchHits(data.symbols);
      } catch {
        setSearchHits([]);
      }
    }, 220);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQ]);

  return (
    <header className="w-full bg-white">
      {/* Logo row */}
      <div className="border-b border-[var(--nse-border)]">
        <div className="mx-auto max-w-[1280px] flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link
              href={withLang(lang, "/market")}
              aria-label="NSE home"
              className="flex items-center"
            >
              <NseLogo />
            </Link>

            {/* Page-level route switch (Market / About). Kept simple and
                always visible so the demo's two views are easy to find.
                No active-state highlight per user preference -- just a
                subtle hover. */}
            <nav
              aria-label="Site sections"
              className="hidden md:flex items-center gap-1 text-[12px]"
            >
              <Link
                href={withLang(lang, "/market")}
                aria-current={isMarket ? "page" : undefined}
                className="px-2.5 py-1 rounded-sm font-semibold tracking-wide text-[var(--nse-navy)] hover:bg-[var(--nse-page)] transition-colors"
              >
                {t("Market")}
              </Link>
              <Link
                href={withLang(lang, "/about")}
                aria-current={isAbout ? "page" : undefined}
                className="px-2.5 py-1 rounded-sm font-semibold tracking-wide text-[var(--nse-navy)] hover:bg-[var(--nse-page)] transition-colors"
              >
                {t("About NSE")}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button
              type="button"
              aria-label="Open search"
              onClick={() => setSearchOpen((v) => !v)}
              className={`grid place-items-center h-9 w-9 rounded-full border ${
                searchOpen
                  ? "bg-[var(--nse-page)] border-[var(--nse-link)] text-[var(--nse-link)]"
                  : "border-[var(--nse-border)] hover:bg-[var(--nse-page)]"
              }`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  d="M10 18a8 8 0 1 1 5.293-13.998A8 8 0 0 1 10 18Zm6-2 5 5"
                />
              </svg>
            </button>

            {/* Login dropdown trigger */}
            <div
              className="relative"
              onMouseEnter={() => setLoginOpen(true)}
              onMouseLeave={() => setLoginOpen(false)}
            >
              <button
                type="button"
                onClick={() => setLoginOpen((v) => !v)}
                className="flex items-center gap-2 rounded-sm bg-[var(--nse-red)] px-4 py-2 text-white text-[12px] font-semibold tracking-wide hover:bg-[var(--nse-red-dark)]"
              >
                {t("LOGIN")}
                <Chevron open={loginOpen} />
              </button>
              {loginOpen && (
                <div className="absolute right-0 top-full z-50 w-64 bg-white border border-[var(--nse-border)] shadow-xl text-[var(--nse-fg)]">
                  <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-[var(--nse-muted)] border-b border-[var(--nse-border)]">
                    {t("Login to")}
                  </div>
                  <ul className="py-1 text-[12px]">
                    {LOGIN_PORTALS.map((p) => (
                      <li
                        key={p}
                        className="px-4 py-1.5 hover:bg-[var(--nse-page)] cursor-pointer flex items-center justify-between"
                      >
                        <span>{t(p)}</span>
                        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
                          <path d="M3 1l5 5-5 5" stroke="currentColor" fill="none" strokeWidth="1.5" />
                        </svg>
                      </li>
                    ))}
                  </ul>
                  <div className="px-4 py-2 text-[10px] text-[var(--nse-muted)] border-t border-[var(--nse-border)]">
                    {t("You will be redirected to another link to complete the login")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expandable search panel */}
        {searchOpen && (
          <div className="border-t border-[var(--nse-border)] bg-[var(--nse-page)]">
            <div className="mx-auto max-w-[1280px] px-4 py-3 relative">
              <input
                type="search"
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t("Search for company, security, mutual fund, ETF…")}
                className="w-full h-10 px-4 border border-[var(--nse-border-strong)] rounded-sm bg-white outline-none focus:border-[var(--nse-link)] text-[13px]"
              />
              {searchHits.length > 0 && (
                <ul className="absolute z-50 left-4 right-4 mt-1 max-h-72 overflow-auto rounded-sm border border-[var(--nse-border-strong)] bg-white shadow-lg text-[12px]">
                  {searchHits.map((h) => (
                    <li
                      key={h.symbol}
                      className="px-3 py-2 hover:bg-[var(--nse-page)] cursor-pointer flex items-center justify-between"
                    >
                      <span>
                        <span className="font-semibold text-[var(--nse-link)] mr-2">
                          {h.symbol}
                        </span>
                        <span className="text-[var(--nse-muted)]">{h.name}</span>
                      </span>
                      {Array.isArray(h.type) && h.type[0] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--nse-page)] border border-[var(--nse-border)] text-[var(--nse-muted)]">
                          {h.type.join(", ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Primary nav strip */}
      <nav className="bg-[var(--nse-navy)] text-white relative z-30">
        <ul className="mx-auto max-w-[1280px] flex items-stretch px-2">
          {NAV.map((item, i) => (
            <li
              key={item.label}
              className="relative"
              onMouseEnter={() => setOpen(i)}
              onMouseLeave={() => setOpen(null)}
            >
              <button
                type="button"
                className={`h-10 px-3 text-[11.5px] font-semibold tracking-[0.04em] hover:bg-[var(--nse-navy-2)] flex items-center gap-1 ${
                  item.highlighted ? "bg-[var(--nse-navy-2)]" : ""
                }`}
              >
                {t(item.label)}
                {item.sub && <Chevron />}
              </button>
              {item.sub && open === i && (
                <ul className="absolute left-0 top-full z-40 min-w-[230px] bg-white text-[var(--nse-fg)] border border-[var(--nse-border)] shadow-lg">
                  {item.sub.map((s) => (
                    <li
                      key={s}
                      className="px-3 py-2 text-[12px] hover:bg-[var(--nse-page)] hover:text-[var(--nse-link)] cursor-pointer border-b border-[var(--nse-border)] last:border-0"
                    >
                      {t(s)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
