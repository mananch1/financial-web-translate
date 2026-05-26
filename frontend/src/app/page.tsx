import { redirect } from "next/navigation";

// Root is just an alias for /market. Keeping /market as the canonical
// home URL means the two top-level routes -- /market and /about -- have
// a parallel shape, and language switching (/hindi -> /hindi/market) is
// symmetric with /hindi/about.
//
// Notes:
// * This is a Server Component (no "use client") so the redirect happens
//   on the server -- the browser ever sees /market, never a flash of /.
// * The proxy handles the /<lang> case separately (see proxy.ts) so this
//   file is only reached when the request is for the bare "/" path.
export default function RootPage(): never {
  redirect("/market");
}
