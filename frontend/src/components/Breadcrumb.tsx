"use client";

// Breadcrumb strip shown between the market ticker and the page title.
// Matches NSE's pattern of "Home > Companies & Listing > Corporate Filings".

import Link from "next/link";

import { useLang } from "@/lib/LangProvider";
import { withLang } from "@/lib/languages";

export default function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  const { lang, t } = useLang();

  // Internal hrefs (start with `/`) get re-prefixed for the current language
  // so `Home -> /` becomes `Home -> /hindi/market` etc.
  const resolveHref = (href: string): string => {
    if (!href || href === "#") return href;
    if (!href.startsWith("/")) return href;
    return withLang(lang, href);
  };
  return (
    <nav
      aria-label="Breadcrumb"
      className="bg-white border-b border-[var(--nse-border)]"
    >
      <ol className="mx-auto max-w-[1280px] flex items-center gap-1.5 px-4 py-2 text-[11.5px] text-[var(--nse-muted)]">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.label} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-[var(--nse-border-strong)]">
                  ›
                </span>
              )}
              {last || !it.href ? (
                <span
                  className={
                    last ? "font-semibold text-[var(--nse-fg)]" : undefined
                  }
                  aria-current={last ? "page" : undefined}
                >
                  {t(it.label)}
                </span>
              ) : (
                <Link
                  href={resolveHref(it.href)}
                  className="hover:text-[var(--nse-link)] hover:underline"
                >
                  {t(it.label)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
