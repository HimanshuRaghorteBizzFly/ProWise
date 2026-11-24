/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
