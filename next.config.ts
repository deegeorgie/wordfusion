import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles the deployment output; standalone copying is unnecessary.
  typescript: {
    // Do not hide TypeScript errors during production builds.
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
