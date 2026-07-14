import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // fal.ai host hun gegenereerde illustraties op dit domein (Flux-model, fase 4).
    remotePatterns: [
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "*.fal.media" },
    ],
  },
};

export default nextConfig;
