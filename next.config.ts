import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default (1MB) is too small for real regulatory documents (protocols,
      // IBs). Prototype-phase storage is local disk (src/lib/storage.ts) —
      // revisit this limit once Phase 5 moves to real object storage.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
