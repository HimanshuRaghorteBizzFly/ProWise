/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optional separate build output, so `next build` can run while `next dev` keeps using .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_BACKEND_URL || "http://localhost:8081"}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
