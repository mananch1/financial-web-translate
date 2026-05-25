// Single source of truth for the language registry.
//
// Lives in its own file (instead of inside strings.ts) so that
// `src/proxy.ts` can import it without pulling in the ~115-entry
// UI_STRINGS array. Keeping the middleware bundle small matters because
// it runs on every request that matches the matcher.

export interface LanguageDef {
  /** ISO code passed to translate-api and stored on `<html lang>`. */
  code: string;
  /** Native-script + English label shown in the language picker. */
  display: string;
  /** Plain English name (used by the translator prompt). */
  english: string;
  /**
   * URL slug. `undefined` for English (the default, served at the
   * canonical path with no prefix). Everything else maps to a path
   * segment like `/marathi/...` that middleware rewrites with `x-lang`.
   */
  slug?: string;
}

export const SUPPORTED_LANGUAGES: LanguageDef[] = [
  { code: "en", display: "English",              english: "English"   /* no slug */ },
  { code: "hi", display: "हिन्दी (Hindi)",        english: "Hindi",     slug: "hindi"     },
  { code: "mr", display: "मराठी (Marathi)",       english: "Marathi",   slug: "marathi"   },
  { code: "gu", display: "ગુજરાતી (Gujarati)",    english: "Gujarati",  slug: "gujarati"  },
  { code: "bn", display: "বাংলা (Bengali)",       english: "Bengali",   slug: "bengali"   },
  { code: "kn", display: "ಕನ್ನಡ (Kannada)",       english: "Kannada",   slug: "kannada"   },
  { code: "ta", display: "தமிழ் (Tamil)",        english: "Tamil",     slug: "tamil"     },
  { code: "te", display: "తెలుగు (Telugu)",       english: "Telugu",    slug: "telugu"    },
  { code: "pa", display: "ਪੰਜਾਬੀ (Punjabi)",      english: "Punjabi",   slug: "punjabi"   },
  { code: "ml", display: "മലയാളം (Malayalam)",    english: "Malayalam", slug: "malayalam" },
  { code: "or", display: "ଓଡ଼ିଆ (Oriya)",         english: "Oriya",     slug: "oriya"     },
  { code: "as", display: "অসমীয়া (Assamese)",    english: "Assamese",  slug: "assamese"  },
  { code: "ur", display: "اردو (Urdu)",            english: "Urdu",      slug: "urdu"      },
];

/** All language codes we accept, including "en". */
export const LANGUAGE_CODES: ReadonlySet<string> = new Set(
  SUPPORTED_LANGUAGES.map((l) => l.code),
);

/** Pretty URL slug -> ISO code. e.g. "hindi" -> "hi". Excludes English. */
export const SLUG_TO_CODE: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    SUPPORTED_LANGUAGES
      .filter((l) => l.slug)
      .map((l) => [l.slug as string, l.code]),
  ),
);

/** ISO code -> pretty URL slug. e.g. "hi" -> "hindi". Excludes English. */
export const CODE_TO_SLUG: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    SUPPORTED_LANGUAGES
      .filter((l) => l.slug)
      .map((l) => [l.code, l.slug as string]),
  ),
);

/** All slugs as a set, handy for "is this URL prefix one of ours?". */
export const PRETTY_SEGMENTS: ReadonlySet<string> = new Set(
  Object.keys(SLUG_TO_CODE),
);
