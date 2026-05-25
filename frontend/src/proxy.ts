// Pretty-URL i18n routing (Next.js 16+ "proxy" convention).
//
// Visiting `/hindi/foo` internally renders `/foo` with a request header
// `x-lang: hi`. The browser URL bar still shows `/hindi/foo`, which is
// the pattern NSE itself uses.
//
// The header is read by `app/layout.tsx` (a server component) and threaded
// down to `<LangProvider>` as `initialLang`.
//
// NOTE: Next.js 16 renamed `middleware.ts` → `proxy.ts`. The old file is
// deprecated and may not run in `next dev` (causing 404 on `/hindi`).
// This file MUST live at `src/proxy.ts` when using a `src/` directory.

import { NextResponse, type NextRequest } from "next/server";

import { SLUG_TO_CODE } from "@/lib/languages";

export function proxy(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  const lang = first ? SLUG_TO_CODE[first] : undefined;
  if (!lang) return NextResponse.next();

  // Rewrite to the same URL minus the language prefix.
  const url = req.nextUrl.clone();
  const rest = segments.slice(1).join("/");
  url.pathname = rest ? `/${rest}` : "/";

  // Mutate request headers so the server-component layout can read x-lang.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-lang", lang);

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
}

// Next.js requires `matcher` to be a statically analysable literal at
// build time -- no array spreading, flatMap, or imports allowed here.
// Keep this list in sync with the `slug` values in `lib/languages.ts`.
export const config = {
  matcher: [
    "/hindi",      "/hindi/:path*",
    "/marathi",    "/marathi/:path*",
    "/gujarati",   "/gujarati/:path*",
    "/bengali",    "/bengali/:path*",
    "/kannada",    "/kannada/:path*",
    "/tamil",      "/tamil/:path*",
    "/telugu",     "/telugu/:path*",
    "/punjabi",    "/punjabi/:path*",
    "/malayalam",  "/malayalam/:path*",
    "/oriya",      "/oriya/:path*",
    "/assamese",   "/assamese/:path*",
    "/urdu",       "/urdu/:path*",
  ],
};
