import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API calls to the Express backend so the browser stays same-origin.
  // Set BACKEND_URL when the backend is hosted elsewhere (e.g. Railway/Render).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
