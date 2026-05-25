"use client";

// Breadcrumb strip shown between the market ticker and the page title.
// Matches NSE's pattern of "Home > Companies & Listing > Corporate Filings".

import { useT } from "@/lib/LangProvider";

export default function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  const t = useT();
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
                <a
                  href={it.href}
                  className="hover:text-[var(--nse-link)] hover:underline"
                >
                  {t(it.label)}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
