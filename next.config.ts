import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-right" },
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      // Ring product images returned by the Ring API (device attributes.image_url)
      { protocol: "https", hostname: "app-content.ring.com" },
      { protocol: "https", hostname: "**.ring.com" },
    ],
  },
};

export default nextConfig;
