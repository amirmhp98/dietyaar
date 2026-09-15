import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Browsers ignore HSTS over plain HTTP, so it is safe to send in development too.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',

  // pino's pretty transport runs in a worker thread the bundler cannot trace.
  serverExternalPackages: ['pino', 'pino-pretty'],

  images: {
    remotePatterns: [
      // Add remote image hosts here as needed.
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    optimizePackageImports: ['lucide-react'],
  },

  // Next.js already sets immutable Cache-Control on /_next/static and /_next/image;
  // only security headers are added here.
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
