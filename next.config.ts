import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The scoring model ships as a static asset and is fetched by the browser.
  // Nothing about a message is ever sent to the server, so it must be cacheable.
  async headers() {
    return [
      {
        source: "/model/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
