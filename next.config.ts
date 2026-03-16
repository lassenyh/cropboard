import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Allow large image uploads in Route Handlers (cloneable body limit)
    proxyClientMaxBodySize: "50mb",
  },
  // So Vercel uses the correct sharp binary in serverless (no bundle issues)
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
