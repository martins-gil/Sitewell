import type { MetadataRoute } from "next";

// Makes the app installable ("Add to Home Screen") on iPad/Android — see
// README.md for what this does and doesn't get you vs. a real native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SiteWell-ct",
    short_name: "SiteWell-ct",
    description: "Clinical trial site platform — patients, visits, and eISF documents.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
