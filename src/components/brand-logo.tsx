import { LOGO_SRC } from "@/lib/brand";

/**
 * The SiteWell-ct logo (public/brand/, set in src/lib/brand.ts) — or the plain
 * wordmark until a logo file has been added. The logo is drawn in dark blues, so
 * wherever the page behind it is dark (a coloured sidebar, dark mode) it sits on a
 * small light chip to stay readable.
 */
export function BrandLogo({ size, onDark = false }: { size: "login" | "sidebar"; onDark?: boolean }) {
  const height = size === "login" ? "h-20" : "h-11";

  if (!LOGO_SRC) {
    return (
      <span
        className={`font-semibold tracking-tight ${size === "login" ? "text-2xl" : "text-sm"} ${
          onDark ? "text-white" : "text-neutral-900 dark:text-white"
        }`}
      >
        SiteWell-ct
      </span>
    );
  }

  const chip = onDark ? "rounded bg-white/95 p-1" : "dark:rounded dark:bg-white/95 dark:p-1";

  return (
    // A plain <img>: the file is a fixed asset in public/, of a size we don't control.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_SRC} alt="SiteWell-ct" className={`${height} w-auto max-w-full ${chip}`} />
  );
}
