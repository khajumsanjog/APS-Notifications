import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8080/api/:path*",
      },
      {
        source: "/apps/:path*",
        destination: "http://127.0.0.1:8080/apps/:path*",
      },
      {
        source: "/beams/:path*",
        destination: "http://127.0.0.1:8080/beams/:path*",
      },
    ];
  },
};

export default nextConfig;
