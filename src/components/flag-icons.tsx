import type { Locale } from "@/lib/i18n/config";

// Small flag icons, drawn as plain SVG rather than emoji: emoji flags (🇬🇧 🇫🇷 …) don't
// reliably render as flags everywhere — some browser/OS combinations show the two-letter
// country code instead of a picture, which is exactly what a flag picker must not do.
// Simplified but recognisable at the ~20px this is shown at; viewBox is 3:2.

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 30 20" className="h-full w-full overflow-hidden rounded-[3px]" aria-hidden>
      {children}
    </svg>
  );
}

const FLAGS: Record<Locale, React.ReactNode> = {
  en: (
    // Union Jack (simplified).
    <Flag>
      <rect width="30" height="20" fill="#00247d" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#cf142b" strokeWidth="1.5" />
      <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0V20M0 10H30" stroke="#cf142b" strokeWidth="3.4" />
    </Flag>
  ),
  fr: (
    <Flag>
      <rect width="10" height="20" fill="#0055a4" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ef4135" />
    </Flag>
  ),
  de: (
    <Flag>
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#dd0000" />
      <rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    </Flag>
  ),
  it: (
    <Flag>
      <rect width="10" height="20" fill="#009246" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ce2b37" />
    </Flag>
  ),
  es: (
    <Flag>
      <rect width="30" height="20" fill="#aa151b" />
      <rect y="5" width="30" height="10" fill="#f1bf00" />
    </Flag>
  ),
  pt: (
    <Flag>
      <rect width="12" height="20" fill="#006600" />
      <rect x="12" width="18" height="20" fill="#ff0000" />
      <circle cx="12" cy="10" r="4" fill="#ffcc00" stroke="#fff" strokeWidth="0.6" />
    </Flag>
  ),
};

export function FlagIcon({ locale }: { locale: Locale }) {
  return FLAGS[locale];
}
