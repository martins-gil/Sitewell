import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default (1MB) is too small for real regulatory documents (protocols,
      // IBs). Vercel itself refuses any request body over ~4.5MB, so a higher
      // limit here would only turn into an unexplained failure on the deployed
      // site — 4MB keeps Next's own, clearer error in front of it. Bigger files
      // would need uploads straight to the bucket (presigned URLs).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
