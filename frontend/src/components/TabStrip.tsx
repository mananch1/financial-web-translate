"use client";

import { useT } from "@/lib/LangProvider";
import { TABS, type TabId } from "@/lib/types";

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

export default function TabStrip({ active, onChange }: Props) {
  const t = useT();
  return (
    <div className="border-b-2 border-[var(--nse-orange)] bg-[var(--nse-page)]">
      <ul
        role="tablist"
        className="flex flex-wrap items-end -mb-px"
      >
        {TABS.map((tab, i) => {
          const on = tab.id === active;
          return (
            <li key={tab.id} role="presentation" className="flex">
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onChange(tab.id)}
                className={[
                  "px-5 py-2.5 text-[12.5px] font-semibold transition-colors relative",
                  on
                    ? "bg-white text-[var(--nse-navy)] border border-b-0 border-[var(--nse-border-strong)] rounded-t-sm"
                    : "text-[var(--nse-muted)] hover:text-[var(--nse-fg)] hover:bg-white/40",
                  i === 0 ? "" : "",
                ].join(" ")}
              >
                {on && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2px] bg-[var(--nse-orange)]"
                  />
                )}
                {t(tab.label)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
