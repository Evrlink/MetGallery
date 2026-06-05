import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
