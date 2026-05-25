"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchMarketSnapshot } from "@/lib/api";
import { useT } from "@/lib/LangProvider";
import type { MarketSnapshot } from "@/lib/types";

// Top "always streaming" band that shows headline market figures sourced
// from NSE's /api/marketStatus endpoint (proxied through our backend).

interface Stat {
  label: string;
  value: string;
  sub?: string;
  change?: { delta: string; pct: string; positive: boolean };
  asOf?: string;
  fallback?: boolean;
}

const fallback: Stat[] = [
  {
    label: "NIFTY 50",
    value: "23,643.50",
    change: { delta: "-46.10", pct: "-0.19%", positive: false },
    asOf: "15-May-2026 15:30",
    fallback: true,
  },
  {
    label: "Futures",
    sub: "26-May-2026",
    value: "23,769.00",
    change: { delta: "+107.00", pct: "+0.45%", positive: true },
    asOf: "16-May-2026 02:30",
    fallback: true,
  },
  {
    label: "USD-INR",
    sub: "26-May-2026",
    value: "95.8400",
    asOf: "15-May-2026 17:00",
    fallback: true,
  },
  {
    label: "Market Capitalization",
    value: "Lac Crs 460.92",
    sub: "Tn $ 4.8",
    asOf: "15-May-2026",
    fallback: true,
  },
];

function fmtNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function buildStats(snap: MarketSnapshot | null): Stat[] {
  if (!snap) return fallback;
  const out = [...fallback];

  if (snap.nifty50?.last != null) {
    const positive = (snap.nifty50.change ?? 0) >= 0;
    out[0] = {
      label: "NIFTY 50",
      value: fmtNumber(snap.nifty50.last),
      change: {
        delta: `${positive ? "+" : ""}${fmtNumber(snap.nifty50.change)}`,
        pct: `${positive ? "+" : ""}${fmtNumber(snap.nifty50.percentChange)}%`,
        positive,
      },
      asOf: snap.nifty50.asOf ?? undefined,
    };
  }

  if (snap.futures?.last != null) {
    const positive = (snap.futures.change ?? 0) >= 0;
    out[1] = {
      label: "Futures",
      sub: snap.futures.expiry ?? undefined,
      value: fmtNumber(snap.futures.last),
      change: {
        delta: `${positive ? "+" : ""}${fmtNumber(snap.futures.change)}`,
        pct: `${positive ? "+" : ""}${fmtNumber(snap.futures.percentChange)}%`,
        positive,
      },
      asOf: snap.futures.asOf ?? undefined,
    };
  }

  if (snap.usdinr?.last != null) {
    out[2] = {
      label: "USD-INR",
      sub: snap.usdinr.expiry ?? undefined,
      value: fmtNumber(snap.usdinr.last, 4),
      asOf: snap.usdinr.asOf ?? undefined,
    };
  }

  if (snap.marketCap?.lacCrs != null) {
    out[3] = {
      label: "Market Capitalization",
      value: `Lac Crs ${fmtNumber(snap.marketCap.lacCrs)}`,
      sub:
        snap.marketCap.tnUSD != null
          ? `Tn $ ${fmtNumber(snap.marketCap.tnUSD)}`
          : undefined,
      asOf: snap.marketCap.asOf ?? undefined,
    };
  }

  return out;
}

export default function MarketTicker() {
  const t = useT();
  const [snap, setSnap] = useState<MarketSnapshot | null>(null);
  const [streaming, setStreaming] = useState(true);
  const [speed, setSpeed] = useState<"Slow" | "Medium" | "Fast">("Medium");

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const data = await fetchMarketSnapshot(ctrl.signal);
        if (!cancelled) setSnap(data);
      } catch {
        /* ignore – fallback renders */
      }
    };
    void load();
    const intervalMs =
      speed === "Slow" ? 60_000 : speed === "Fast" ? 10_000 : 30_000;
    const iv = streaming ? setInterval(load, intervalMs) : null;
    return () => {
      cancelled = true;
      ctrl.abort();
      if (iv) clearInterval(iv);
    };
  }, [streaming, speed]);

  const stats = useMemo(() => buildStats(snap), [snap]);
  const isOpen = useMemo(() => {
    const cap = snap?.marketStates?.find((m) => m.market === "Capital Market");
    return cap?.status === "Open";
  }, [snap]);

  return (
    <div className="w-full bg-white border-b border-[var(--nse-border)]">
      <div className="mx-auto max-w-[1280px] flex items-stretch px-4">
        {/* Streaming controls */}
        <div className="flex flex-col justify-center gap-1 pr-4 border-r border-[var(--nse-border)] py-2 text-[10.5px] text-[var(--nse-muted)] shrink-0 min-w-[180px]">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                streaming
                  ? "bg-[var(--nse-green)] animate-pulse"
                  : "bg-gray-400"
              }`}
            />
            <span className="font-bold uppercase tracking-wider text-[var(--nse-fg)]">
              {t("Streaming")}
            </span>
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-px rounded-sm ${
                isOpen
                  ? "bg-[var(--nse-green)]/10 text-[var(--nse-green)] border border-[var(--nse-green)]/30"
                  : "bg-[var(--nse-red)]/10 text-[var(--nse-red)] border border-[var(--nse-red)]/30"
              }`}
            >
              {isOpen ? t("Open") : t("Closed")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{t("on")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={streaming}
              onClick={() => setStreaming((s) => !s)}
              className={`h-3 w-7 rounded-full relative transition-colors ${
                streaming ? "bg-[var(--nse-green)]" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 ${
                  streaming ? "left-3.5" : "left-0.5"
                } h-2 w-2 rounded-full bg-white transition-all`}
              />
            </button>
            <span>{t("off")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{t("Streaming Speed")}</span>
          </div>
          <div className="flex items-center gap-1.5 -mt-0.5">
            {(["Slow", "Medium", "Fast"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={
                  speed === s
                    ? "text-[var(--nse-link)] font-semibold"
                    : "hover:text-[var(--nse-fg)]"
                }
              >
                {t(s)}
              </button>
            ))}
          </div>
        </div>

        {/* Stat cells */}
        <ul className="flex items-stretch flex-1 overflow-hidden">
          {stats.map((s, i) => (
            <li
              key={i}
              className="flex flex-col justify-center px-5 py-2 border-r border-[var(--nse-border)] last:border-r-0 min-w-[210px] flex-1"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[10.5px] font-bold text-[var(--nse-navy)] uppercase tracking-[0.06em]">
                  {t(s.label)}
                </span>
                {s.sub && (
                  <span className="text-[10px] text-[var(--nse-muted)]">
                    {s.sub}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-[17px] font-bold tabular-nums leading-tight ${
                    s.fallback
                      ? "text-[var(--nse-muted)]"
                      : "text-[var(--nse-fg)]"
                  }`}
                >
                  {s.value}
                </span>
                {s.change && (
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      s.change.positive
                        ? "text-[var(--nse-green)]"
                        : "text-[var(--nse-red)]"
                    }`}
                  >
                    {s.change.delta} ({s.change.pct})
                  </span>
                )}
              </div>
              {s.asOf && (
                <span className="text-[10px] text-[var(--nse-muted)] mt-0.5">
                  {s.asOf}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* View All link */}
        <div className="hidden md:flex items-center pl-4 border-l border-[var(--nse-border)] shrink-0">
          <a
            href="#"
            className="text-[11px] font-semibold uppercase tracking-wider text-[var(--nse-link)] hover:underline whitespace-nowrap"
          >
            {t("View All")} →
          </a>
        </div>
      </div>
    </div>
  );
}
