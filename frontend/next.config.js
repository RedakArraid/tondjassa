/** @type {import('next').NextConfig} */
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

function safeOrigin(value) {
  try { return new URL(value).origin; } catch { return null; }
}

const siteOrigin = safeOrigin(siteUrl);
const apiOrigin = safeOrigin(apiUrl);
const httpsSite = Boolean(siteOrigin && siteOrigin.startsWith('https://'));
const connectSources = ["'self'"];
if (apiOrigin && apiOrigin !== siteOrigin) connectSources.push(apiOrigin);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://apimandemarket.soubadigital.com",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(' ')}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(httpsSite ? ['upgrade-insecure-requests'] : []),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', port: '4002', pathname: '/uploads/**' },
      { protocol: 'https', hostname: 'apimandemarket.soubadigital.com', port: '', pathname: '/uploads/**' },
      { protocol: 'http', hostname: 'mandemarket-backend', port: '4002', pathname: '/uploads/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', port: '', pathname: '/**' },
    ],
    unoptimized: false,
  },
  typescript: { ignoreBuildErrors: false },
  async rewrites() {
    return [{
      source: '/api/:path*',
      destination: `${process.env.INTERNAL_API_URL || apiUrl}/api/:path*`,
    }];
  },
  async redirects() {
    return [{ source: '/admin', destination: '/admin/login', permanent: false }];
  },
  async headers() {
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '0' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
    ];
    if (httpsSite) {
      securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' });
    }
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  env: {
    CUSTOM_KEY: 'mandemarket',
    DOCKER_ENV: process.env.DOCKER_ENV || 'true',
  },
  compress: true,
  poweredByHeader: false,
  trailingSlash: false,
};

module.exports = nextConfig;
