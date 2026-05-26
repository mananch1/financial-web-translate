"use client";

import Breadcrumb from "@/components/Breadcrumb";
import { useT } from "@/lib/LangProvider";

// English content for the About NSE page. For now every paragraph is also
// listed in UI_STRINGS so the existing dict-based translation can pick it
// up — that mirrors how the rest of the chrome works. A future step will
// move long-form prose to a dedicated per-paragraph cache (see the design
// notes in chat).
const PARAS = [
  "National Stock Exchange of India Limited (NSE) is the leading stock exchange in India and ranks among the largest exchanges in the world by trading volume. Established in 1992 and headquartered in Mumbai, NSE pioneered the introduction of fully electronic, screen-based trading and a dematerialised settlement system in India.",
  "NSE offers a comprehensive range of products and services across the equity, derivatives, debt, currency, and mutual fund segments. The exchange operates one of the most sophisticated electronic trading platforms, with state-of-the-art risk management, clearing, and settlement infrastructure that serves millions of investors every trading day.",
  "Through its flagship index, the NIFTY 50, NSE provides the benchmark for the Indian capital markets and is widely tracked by domestic and international investors. The exchange also runs technology and indices businesses, financial education programmes, and a regulated marketplace for SMEs, debt instruments, REITs, InvITs, and social enterprises.",
  "Continually innovating to meet the evolving needs of the market, NSE remains committed to transparency, investor protection, and the development of a robust, world-class capital market for India.",
] as const;

export default function AboutPage() {
  const t = useT();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "About NSE", href: "/about" },
          { label: "About NSE Company" },
        ]}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-[1280px] px-4 py-6">
          {/* Page title */}
          <div className="mb-5">
            <h1 className="nse-page-title text-[22px] font-bold text-[var(--nse-navy)] tracking-tight">
              {t("About NSE Company")}
            </h1>
          </div>

          {/* Body card */}
          <article className="bg-white rounded-sm shadow-sm border border-[var(--nse-border-strong)] p-6 md:p-8">
            <h2 className="text-[16px] font-bold text-[var(--nse-navy)] mb-3">
              {t("Our Company")}
            </h2>
            <div className="space-y-4 text-[13.5px] leading-relaxed text-[var(--nse-fg)]">
              {PARAS.map((p, i) => (
                <p key={i}>{t(p)}</p>
              ))}
            </div>

            <div className="mt-7 grid gap-6 md:grid-cols-2">
              <div className="border-l-4 border-[var(--nse-navy)] pl-4">
                <h3 className="text-[14px] font-semibold text-[var(--nse-navy)] mb-1.5">
                  {t("Our Vision")}
                </h3>
                <p className="text-[13px] leading-relaxed text-[var(--nse-fg)]">
                  {t(
                    "To be a globally competitive stock exchange that contributes to building a transparent, inclusive, and resilient capital market in India.",
                  )}
                </p>
              </div>
              <div className="border-l-4 border-[var(--nse-red)] pl-4">
                <h3 className="text-[14px] font-semibold text-[var(--nse-navy)] mb-1.5">
                  {t("Our Mission")}
                </h3>
                <p className="text-[13px] leading-relaxed text-[var(--nse-fg)]">
                  {t(
                    "To provide a world-class, technology-driven trading platform that promotes fair, transparent, and efficient price discovery, while empowering investors and contributing to nation-building.",
                  )}
                </p>
              </div>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
