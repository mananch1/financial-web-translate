// Pretty-URL i18n routing.
//
// Visiting `/hindi/foo` internally renders `/foo` with a request header
// `x-lang: hi`. The browser URL bar still shows `/hindi/foo`, which is
// the pattern NSE itself uses.
//
// The header is read by `app/layout.tsx` (a server component) and threaded
// down to `<LangProvider>` as `initialLang`. From that point on the React
// tree behaves the same way it does for a direct `?lang=hi` visit.
//
// NOTE: when the project uses a `src/` directory this file MUST live at
// `src/middleware.ts`, not at the repo root, otherwise Next.js silently
// ignores it.

import { NextResponse, type NextRequest } from "next/server";

import { SLUG_TO_CODE } from "@/lib/languages";

export function middleware(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();
  const lang = first ? SLUG_TO_CODE[first] : undefined;
  if (!lang) return NextResponse.next();

  // Rewrite to the same URL minus the language prefix.
  const url = req.nextUrl.clone();
  url.pathname = "/" + segments.slice(1).join("/");

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
// (The middleware function itself uses the imported registry, so adding
// a slug here is the *only* duplication when wiring a new language.)
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
