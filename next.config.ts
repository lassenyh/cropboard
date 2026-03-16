import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Allow large image uploads in Route Handlers (cloneable body limit)
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
