/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🐳 Configuration Docker optimisée
  output: 'standalone',
  outputFileTracingRoot: require('path').resolve(__dirname),
  
  // 🖼️ Configuration des images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4002',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'apimandemarket.soubadigital.com',
        port: '',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'mandemarket-backend',
        port: '4002',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: false,
  },
  
  // 🔧 Configuration ESLint et TypeScript pour Docker
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // 🌐 Configuration des rewrites pour l'API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002'}/api/:path*`,
      },
    ];
  },
  
  // 🔄 Configuration des redirections
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/login',
        permanent: false,
      },
    ];
  },
  
  // 🔒 Configuration des headers de sécurité
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_SITE_URL || process.env.CORS_ORIGIN || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
        ],
      },
    ];
  },
  
  // 🔧 Configuration expérimentale
  // Public build configuration
  env: {
    CUSTOM_KEY: 'mandemarket',
    DOCKER_ENV: process.env.DOCKER_ENV || 'true',
  },
  
  // ⚡ Configuration des performances
  compress: true,
  poweredByHeader: false,
  
  // 🔍 Configuration de traçabilité
  trailingSlash: false,
  
  // 📱 Configuration PWA (si nécessaire)

}

module.exports = nextConfig
