import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // src/lib/data.ts reads these with fs at runtime; make sure they ship with the API functions.
  outputFileTracingIncludes: {
    '/api/**': ['./data/*.json'],
  },
};

export default nextConfig;
