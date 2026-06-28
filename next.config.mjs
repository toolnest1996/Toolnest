import { toolSlugRedirects } from "./lib/data/tool-redirects.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    return Object.entries(toolSlugRedirects).map(([source, destination]) => ({
      source: `/tool/${source}`,
      destination: `/tool/${destination}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
