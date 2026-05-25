"use client";

// NSE site footer: a row of "Quick Links" columns, then a dark navy
// copyright strip.

import { useT } from "@/lib/LangProvider";

const COLS: { title: string; links: string[] }[] = [
  {
    title: "About Us",
    links: ["Overview", "Board of Directors", "Awards & Recognitions", "Careers", "Media Centre"],
  },
  {
    title: "Investor Services",
    links: ["Investor Charter", "Investor Grievance", "Investor Education", "Investor Protection Fund"],
  },
  {
    title: "Trade",
    links: ["Equity", "Derivatives", "Currency", "Commodity", "Debt", "Mutual Funds"],
  },
  {
    title: "Listing",
    links: ["Equity", "SME", "Debt", "Mutual Funds", "Sovereign Gold Bond"],
  },
  {
    title: "Resources",
    links: ["Reports", "Circulars", "Bye-Laws", "Regulations", "Holiday Calendar"],
  },
  {
    title: "Connect",
    links: ["Contact Us", "Branch Offices", "Help & FAQs", "Sitemap"],
  },
];

const SOCIAL = ["x", "linkedin", "youtube", "instagram", "facebook"] as const;

export default function Footer() {
  const t = useT();
  return (
    <footer className="mt-12">
      <section className="bg-white border-t border-[var(--nse-border)]">
        <div className="mx-auto max-w-[1280px] px-4 py-8">
          <h2 className="text-[13px] font-bold text-[var(--nse-navy)] uppercase tracking-wide mb-4">
            {t("Quick Links")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-[12px]">
            {COLS.map((c) => (
              <div key={c.title}>
                <div className="font-semibold text-[var(--nse-navy)] mb-2">
                  {t(c.title)}
                </div>
                <ul className="space-y-1.5 text-[var(--nse-muted)]">
                  {c.links.map((l) => (
                    <li key={l} className="hover:text-[var(--nse-link)] cursor-pointer">
                      {t(l)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            {SOCIAL.map((s) => (
              <span
                key={s}
                aria-label={s}
                className="grid place-items-center h-7 w-7 rounded-full bg-[var(--nse-page)] border border-[var(--nse-border)] text-[var(--nse-navy)] text-[10px] uppercase"
              >
                {s[0]}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[var(--nse-navy)] text-white">
        <div className="mx-auto max-w-[1280px] px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-[11px]">
          <span>
            {t(
              "Copyright © National Stock Exchange of India Ltd. All rights reserved. Best viewed in Chrome and 1366 × 768 resolution. Recommended to use latest browser versions.",
            )}
          </span>
          <span className="rounded-sm bg-white/10 px-2 py-1 font-semibold">
            {t("GIGW Compliant")}
          </span>
        </div>
      </section>
    </footer>
  );
}
