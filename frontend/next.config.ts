import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Output standalone build for Docker deployment
  output: 'standalone',

  // Transpile specific packages if needed
  transpilePackages: [],

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.pocketbase.io',
      },
    ],
  },
};

export default nextConfig;
