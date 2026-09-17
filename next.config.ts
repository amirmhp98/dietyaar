import type { NextConfig } from 'next';

/**
 * Content Security Policy (tech spec § 8). `connect-src 'self'` holds because
 * Sentry, when added, tunnels through `/monitoring` (decision O9) and the
 * browser never talks to a third-party host. `next dev` evaluates code with
 * `eval`, so `'unsafe-eval'` is added outside production only.
 */
const scriptSrc = ["'self'", "'unsafe-inline'"];
if (process.env.NODE_ENV !== 'production') scriptSrc.push("'unsafe-eval'");

const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "connect-src 'self'",
  `script-src ${scriptSrc.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The camera stays available to this origin so `<input capture>` works on every page.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
  // Browsers ignore HSTS over plain HTTP, so it is safe to send in development too.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',

  // pino's pretty transport runs in a worker thread the bundler cannot trace;
  // sharp ships native binaries (`@img/*`) that must stay in node_modules.
  serverExternalPackages: ['pino', 'pino-pretty', 'sharp'],

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
