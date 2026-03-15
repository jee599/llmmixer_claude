import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@llmmixer/core'],
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
}

export default nextConfig
