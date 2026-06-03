/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://ekiapp-backend.vercel.app/api/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    // The admin panel is showing intermittent Windows-only cache corruption
    // around `.next/server/vendor-chunks/@swc.js`. Disabling webpack's
    // persistent cache in dev keeps the build graph stable.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
