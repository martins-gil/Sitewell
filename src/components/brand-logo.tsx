import { LOGO_SRC, LOGO_SRC_WHITE } from "@/lib/brand";

/**
 * The SiteWell-ct logo (public/brand/, set in src/lib/brand.ts) — or the plain wordmark
 * until a logo file has been added. In the dark theme the white version of the logo (same
 * size) takes its place. Both are in the page and CSS picks one (`dark:` follows the class on
 * <html>, including "match my device"), so there is no flash when the theme changes.
 */
export function BrandLogo({ size }: { size: "login" | "sidebar" }) {
  const height = size === "login" ? "h-20" : "h-11";

  if (!LOGO_SRC) {
    return (
      <span className={`font-semibold tracking-tight ${size === "login" ? "text-2xl" : "text-sm"}`}>SiteWell-ct</span>
    );
  }

  return (
    <>
      {/* Plain <img>s: fixed assets in public/, of a size we don't control. */}
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt="SiteWell-ct"
        className={`${height} w-auto max-w-full ${
          LOGO_SRC_WHITE ? "dark:hidden" : "dark:rounded dark:bg-white/95 dark:p-1"
        }`}
      />
      {LOGO_SRC_WHITE && (
        <img src={LOGO_SRC_WHITE} alt="SiteWell-ct" className={`hidden ${height} w-auto max-w-full dark:block`} />
      )}
      {/* eslint-enable @next/next/no-img-element */}
    </>
  );
}
