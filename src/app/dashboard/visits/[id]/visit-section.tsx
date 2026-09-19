import type { ReactNode } from "react";
import type { SectionMode } from "@/lib/preferences";

/**
 * One block of the visit page, shown / collapsed / hidden according to the
 * user's Settings. Collapsed and shown both render (so a collapsed one can be
 * opened with a click); hidden renders nothing.
 */
export function VisitSection({
  title,
  mode,
  children,
}: {
  title: ReactNode;
  mode: SectionMode;
  children: ReactNode;
}) {
  if (mode === "hidden") return null;
  return (
    <details open={mode === "show"} className="group">
      <summary className="mb-3 flex cursor-pointer select-none list-none items-center gap-1.5 text-sm font-medium text-neutral-500 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block text-xs transition-transform group-open:rotate-90">
          ▸
        </span>
        {title}
      </summary>
      {children}
    </details>
  );
}
