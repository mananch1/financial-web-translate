"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { loadDictionaryOrNull, type Dictionary } from "./i18n";
import {
  CODE_TO_SLUG,
  LANGUAGE_CODES,
  PRETTY_SEGMENTS,
  SLUG_TO_CODE,
} from "./languages";

// Context shape: current language code, a setter that navigates to the
// right URL, and a `t()` lookup that's safe to call before the dictionary
// has loaded (returns the English key as a fallback).
interface LangContextValue {
  lang: string;
  ready: boolean;
  setLang: (code: string) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function normaliseLang(raw: string | null | undefined): string {
  const v = (raw ?? "en").toLowerCase();
  return LANGUAGE_CODES.has(v) ? v : "en";
}

/**
 * Pull the language code out of a pathname. `/hindi/foo` -> "hi".
 * Returns "en" when no recognised prefix is present.
 */
function langFromPath(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return (first && SLUG_TO_CODE[first]) || "en";
}

/**
 * Strip a `/hindi` (or other pretty-lang) prefix from a path, returning
 * the canonical English path. `/hindi/foo` -> `/foo`. `/` -> `/`.
 */
function stripLangPrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  if (PRETTY_SEGMENTS.has(segments[0].toLowerCase())) {
    const rest = segments.slice(1).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname;
}

export function LangProvider({
  initialLang,
  initialDict,
  children,
}: {
  initialLang?: string;
  initialDict?: Dictionary | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  // Derive the active language from the URL pathname (reactive on every
  // client-side navigation) and fall back to the server-provided header
  // only if the path itself doesn't tell us. This is critical: the root
  // layout in App Router does NOT re-render on client navigation, so we
  // can't trust `initialLang` after the first mount.
  const lang = useMemo(() => {
    const fromPath = langFromPath(pathname);
    if (fromPath !== "en") return fromPath;
    return normaliseLang(initialLang);
  }, [pathname, initialLang]);

  const seededLang = normaliseLang(initialLang);
  const [dict, setDict] = useState<Dictionary | null>(initialDict ?? null);
  const [ready, setReady] = useState(
    lang === "en" || (lang === seededLang && !!initialDict),
  );

  // Load (or hit cache) whenever the active language changes. Skip the
  // first run when we already have a server-rendered dictionary for the
  // active language — that's what prevents the flash of English on a
  // direct visit to /hindi.
  useEffect(() => {
    if (lang === "en") {
      setDict(null);
      setReady(true);
      return;
    }
    if (lang === seededLang && initialDict) {
      setDict(initialDict);
      setReady(true);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setReady(false);
    void loadDictionaryOrNull(lang, ctrl.signal).then((d) => {
      if (cancelled) return;
      // On translate-api failure we keep whatever dict is already on
      // screen rather than blow it away with English. That way the
      // user sees a stale (but correct-language) chrome instead of
      // a sudden flip back to English mid-session.
      if (d) setDict(d);
      setReady(true);
    });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [lang, seededLang, initialDict]);

  const setLang = useCallback(
    (code: string) => {
      const next = normaliseLang(code);
      // Compute the canonical English path of wherever we are right now,
      // then re-prefix if needed for the target language.
      const base = stripLangPrefix(pathname);
      const slug = CODE_TO_SLUG[next];
      const target =
        slug && next !== "en"
          ? base === "/"
            ? `/${slug}`
            : `/${slug}${base}`
          : base;
      router.push(target);
    },
    [pathname, router],
  );

  const t = useCallback(
    (key: string): string => {
      if (!dict) return key;
      return dict[key] ?? key;
    },
    [dict],
  );

  const value = useMemo(
    () => ({ lang, ready, setLang, t }),
    [lang, ready, setLang, t],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** Read-only access to the current language and translator. */
export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Defensive default so a component used outside the provider
    // (e.g. in Storybook) still renders English without throwing.
    return {
      lang: "en",
      ready: true,
      setLang: () => {},
      t: (k: string) => k,
    };
  }
  return ctx;
}

/** Sugar for the common case of just needing `t()`. */
export function useT(): (key: string) => string {
  return useLang().t;
}
