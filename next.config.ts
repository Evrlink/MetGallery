import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.metmuseum.org',
      },
      {
        protocol: 'https',
        hostname: 'collection-images.metmuseum.org',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['wagmi', 'viem'],
  },
  async rewrites() {
    return [
      {
        source: '/base-verification.html',
        destination: '/api/base-verification',
      },
    ]
  },
}

export default nextConfig
