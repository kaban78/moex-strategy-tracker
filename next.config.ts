import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// CSP для прода. В dev нужны unsafe-eval и ws: для HMR.
const csp = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://iss.moex.com https://invest-public-api.tinkoff.ru https://www.cbr.ru" +
    (isDev ? ' ws: wss:' : ''),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        // API-роуты: запретить встраивание и любые другие источники.
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
