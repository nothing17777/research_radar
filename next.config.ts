import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Paper/repo thumbnails are scraped og:image URLs from arbitrary sources,
    // so the host isn't known ahead of time.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
