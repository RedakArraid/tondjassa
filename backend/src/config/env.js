const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4002),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET doit contenir au moins 16 caractères'),
  REFRESH_TOKEN_SECRET: z.string().min(16).optional(),
  COOKIE_SECRET: z.string().default('mande-default-cookie-secret-change-prod'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://frontend:3000,http://127.0.0.1:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  METRICS_TOKEN: z.string().min(32, 'METRICS_TOKEN doit contenir au moins 32 caracteres').optional(),
  
  TRUST_PROXY: z.string().optional(),
  CHECKOUT_COUNTRIES: z.string().optional(),
  // Medias (Cloudinary)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Passerelles de paiement
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  CINETPAY_API_KEY: z.string().optional(),
  CINETPAY_SITE_ID: z.string().optional(),

  // Emails transactionnels
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('MandeMarket <noreply@mandemarket.com>'),
  ADMIN_EMAIL: z.string().email().default('admin@mandemarket.com'),

  // URLs
  NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
  BACKEND_URL: z.string().default('http://localhost:4002')
});

function loadConfig() {
  if (process.env.NODE_ENV === 'test') {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://postgres:mandemarket123@localhost:5433/mandemarket';
    }
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'super-secure-test-jwt-secret-key-minimum-32-chars';
    }
  }
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://postgres:mandemarket123@localhost:5433/mandemarket';
    }
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'dev-jwt-secret-mande-market-scalable-local-key-32';
    }
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ ERREUR DE CONFIGURATION : Variables d\'environnement invalides :');
    console.error(JSON.stringify(result.error.format(), null, 2));
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw new Error('Variables d\'environnement invalides');
  }

  const env = result.data;

  if (env.NODE_ENV === 'production') {
    const missing = [];
    if (env.JWT_SECRET.length < 32 || /changeme|change|default|test|dev-jwt/i.test(env.JWT_SECRET)) missing.push('JWT_SECRET fort (32 caracteres minimum)');
    for (const field of ['TRUST_PROXY', 'CHECKOUT_COUNTRIES', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'METRICS_TOKEN']) {
      if (!env[field]) missing.push(field);
    }
    for (const field of ['NEXT_PUBLIC_SITE_URL', 'BACKEND_URL']) {
      try { if (new URL(env[field]).protocol !== 'https:') missing.push(field + ' HTTPS'); } catch { missing.push(field); }
    }
    if (!process.env.CORS_ORIGIN || env.CORS_ORIGIN.split(',').some((o) => !o.trim().startsWith('https://'))) missing.push('CORS_ORIGIN HTTPS');
    if (env.TRUST_PROXY && /^(true|false|\*|\d+)$/i.test(env.TRUST_PROXY)) missing.push('TRUST_PROXY doit contenir les IP/CIDR des proxies, pas true ni un nombre de sauts');
    if (missing.length) throw new Error('Configuration de production incomplete: ' + missing.join(', '));
  }

  return env;
}

const config = loadConfig();

module.exports = config;
