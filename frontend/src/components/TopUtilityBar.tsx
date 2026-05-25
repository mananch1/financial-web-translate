"use client";

import { useEffect, useState } from "react";

import { useLang } from "@/lib/LangProvider";
import { SUPPORTED_LANGUAGES } from "@/lib/strings";

// Thin grey bar above the main header that holds language picker, font-size
// controls and high-contrast toggle. Matches the bar on nseindia.com.

type FontSize = "sm" | "base" | "lg" | "xl";

export default function TopUtilityBar() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [contrast, setContrast] = useState<"normal" | "high">("normal");

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === "base") root.removeAttribute("data-fontsize");
    else root.setAttribute("data-fontsize", fontSize);
  }, [fontSize]);

  useEffect(() => {
    const root = document.documentElement;
    if (contrast === "normal") root.removeAttribute("data-contrast");
    else root.setAttribute("data-contrast", contrast);
  }, [contrast]);

  const currentLangDisplay =
    SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.display ?? "English";

  return (
    <div className="w-full bg-[#f3f4f7] border-b border-[var(--nse-border)] text-[12px] text-[var(--nse-muted)]">
      <div className="mx-auto max-w-[1280px] flex items-center justify-between px-4 h-8">
        {/* Language picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 hover:text-[var(--nse-fg)]"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span>{currentLangDisplay}</span>
            <svg viewBox="0 0 8 6" className="h-2.5 w-2.5 fill-current">
              <path d="M0 0h8L4 6z" />
            </svg>
          </button>
          {open && (
            <ul
              role="listbox"
              className="absolute z-50 top-full left-0 mt-1 w-56 max-h-72 overflow-auto rounded-sm border border-[var(--nse-border)] bg-white shadow-lg"
              onMouseLeave={() => setOpen(false)}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <li
                  key={l.code}
                  role="option"
                  aria-selected={l.code === lang}
                  className={`px-3 py-1.5 cursor-pointer hover:bg-[var(--nse-page)] ${
                    l.code === lang ? "text-[var(--nse-link)]" : ""
                  }`}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                >
                  {l.display}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Font size + contrast controls */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span>{t("Font Size")}</span>
            <button
              type="button"
              aria-label="Increase font size"
              className="hover:text-[var(--nse-fg)]"
              onClick={() =>
                setFontSize((s) =>
                  s === "base" ? "lg" : s === "lg" ? "xl" : s,
                )
              }
            >
              A+
            </button>
            <span aria-hidden>|</span>
            <button
              type="button"
              className="hover:text-[var(--nse-fg)]"
              onClick={() => setFontSize("base")}
            >
              {t("Reset")}
            </button>
            <span aria-hidden>|</span>
            <button
              type="button"
              aria-label="Decrease font size"
              className="hover:text-[var(--nse-fg)]"
              onClick={() =>
                setFontSize((s) =>
                  s === "base" ? "sm" : s === "xl" ? "lg" : s === "lg" ? "base" : s,
                )
              }
            >
              A-
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span>{t("Contrast")}</span>
            <button
              type="button"
              className="hover:text-[var(--nse-fg)]"
              onClick={() => setContrast("high")}
            >
              {t("High Contrast")}
            </button>
            <span aria-hidden>|</span>
            <button
              type="button"
              className="hover:text-[var(--nse-fg)]"
              onClick={() => setContrast("normal")}
            >
              {t("Reset")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
