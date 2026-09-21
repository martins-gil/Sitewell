import { LOGO_SRC } from "@/lib/brand";

/**
 * The SiteWell-ct logo (public/brand/, set in src/lib/brand.ts) — or the plain
 * wordmark until a logo file has been added. On the coloured sidebar the logo sits
 * on a small light chip, so a logo drawn in dark colours stays readable.
 */
export function BrandLogo({ size, onDark = false }: { size: "login" | "sidebar"; onDark?: boolean }) {
  const height = size === "login" ? "h-14" : "h-8";

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

  return (
    // A plain <img>: the file is a fixed asset in public/, of a size we don't control.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="SiteWell-ct"
      className={`${height} w-auto max-w-full ${onDark ? "rounded bg-white/95 p-1" : ""}`}
    />
  );
}
