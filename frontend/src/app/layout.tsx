import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import { loadDictionary } from "@/lib/i18n";
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
// x-lang header set by middleware is read freshly on every page load.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Middleware sets `x-lang` when the URL matches `/hindi/...` etc.
  // Anything else (or a direct `/` visit) implicitly means English.
  const h = await headers();
  const initialLang = h.get("x-lang") ?? "en";

  // Pre-fetch the chrome dictionary on the server so the very first HTML
  // we send already contains translated strings. This kills the "flash of
  // English" you'd otherwise see on direct visits to /hindi.
  //
  // After the first request per language per server process the in-memory
  // `dictCache` map in i18n.ts keeps subsequent SSR fetches free (~0ms).
  // English short-circuits to identity and skips the network entirely.
  const initialDict =
    initialLang === "en" ? null : await loadDictionary(initialLang);

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
            {children}
          </LangProvider>
        </Suspense>
      </body>
    </html>
  );
}
