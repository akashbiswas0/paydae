import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API calls to the Express backend so the browser stays same-origin.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
