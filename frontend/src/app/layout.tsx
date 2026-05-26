import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import MarketTicker from "@/components/MarketTicker";
import TopUtilityBar from "@/components/TopUtilityBar";
import { loadDictionaryOrNull } from "@/lib/i18n";
import { LangProvider } from "@/lib/LangProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title:
    "Corporate Filings Announcement - Equity, SME, Debt, MF - NSE India",
  description:
    "Get corporate filings announcements for Equity, SME, Debt, Mutual Fund, REIT/InvIT, Municipal Bonds, SSE and Debenture Trustee Disclosures filed with NSE India.",
};

// `dynamic = "force-dynamic"` ensures the layout runs per-request so the
// x-lang header set by proxy is read freshly on every page load.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Proxy sets `x-lang` when the URL matches `/hindi/...` etc.
  // Anything else (or a direct `/` visit) implicitly means English.
  const h = await headers();
  const initialLang = h.get("x-lang") ?? "en";

  // Pre-fetch the chrome dictionary on the server so the very first HTML
  // we send already contains translated strings. This kills the "flash of
  // English" you'd otherwise see on direct visits to /hindi.
  //
  // After the first request per language per server process the in-memory
  // `dictCache` map in i18n.ts keeps subsequent SSR fetches free (~0ms).
  // English short-circuits to null and skips the network entirely.
  //
  // We use the *strict* variant: on translate-api failure it returns null
  // instead of an English identity dict. That distinction matters --
  // shipping identity to <LangProvider> would lock the page into English
  // even on a /hindi URL, which is exactly the bug we hit when Groq's
  // free-tier rate limit kicked in mid-session.
  const initialDict =
    initialLang === "en" ? null : await loadDictionaryOrNull(initialLang);

  return (
    <html lang={initialLang} className={`${inter.className} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--nse-page)] text-[var(--nse-fg)]">
        {/* Suspense wrapper is required because LangProvider reads
            useSearchParams(), which suspends during static rendering. */}
        <Suspense fallback={null}>
          <LangProvider
            initialLang={initialLang}
            initialDict={initialDict}
          >
            {/* Site-wide chrome lives here so every /market and /about
                page shares it without re-mounting components on nav. */}
            <TopUtilityBar />
            <Header />
            <MarketTicker />
            {children}
            <Footer />
          </LangProvider>
        </Suspense>
      </body>
    </html>
  );
}
