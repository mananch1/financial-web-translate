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

  // Bare `/<lang>` (no further path): redirect to `/<lang>/market` so the
  // language homepage points at the actual market view, matching the
  // English `/` -> `/market` server redirect.
  if (segments.length === 1) {
    const target = req.nextUrl.clone();
    target.pathname = `/${first}/market`;
    return NextResponse.redirect(target);
  }

  // `/<lang>/<rest>`: rewrite to `/<rest>` and stash the language in
  // a request header so the server-component layout can pre-fetch the
  // dictionary before the first paint.
  const url = req.nextUrl.clone();
  url.pathname = "/" + segments.slice(1).join("/");

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
