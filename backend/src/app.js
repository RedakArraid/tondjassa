const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const path = require('path');
const { checkConfiguration } = require('./services/cloudinary.service');

const app = express();
const PORT = process.env.PORT || 4002;
const isProd = process.env.NODE_ENV === 'production';
const config = require('./config/env');
if (config.TRUST_PROXY) app.set('trust proxy', config.TRUST_PROXY.split(',').map((s) => s.trim()));
app.disable('x-powered-by');

console.log('\n🔍 Vérification de la configuration Cloudinary...');
checkConfiguration();

const productRoutes = require('./routes.product');
const categoryRoutes = require('./routes.category');
const authRoutes = require('./routes.auth');
const dashboardRoutes = require('./routes.dashboard');
const orderRoutes = require('./routes.orders');
const customerRoutes = require('./routes.customers');
const promotionRoutes = require('./routes.promotions');
const reviewRoutes = require('./routes.reviews');
const sellerRoutes = require('./routes.sellers');
const accountRoutes = require('./routes.account');
const paymentRoutes = require('./routes.payment');
const shippingRoutes = require('./routes.shipping');
const checkoutRoutes = require('./routes.checkout');
const adminRoutes = require('./routes.admin');
const contactRoutes = require('./routes.contact');

const allowedOrigins = isProd ? [] : [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://frontend:3000',
  'http://frontend:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://mandemarket-frontend:3001',
  'https://mandemarket.soubadigital.com',
  'https://apimandemarket.soubadigital.com',
];

if (process.env.CORS_ORIGIN) {
  for (const o of process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
  }
}

function isOriginAllowed(origin) {
  return !origin || allowedOrigins.includes(origin);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  })
);
app.use(compression());

const crypto = require('crypto');
const db = require('./db');
const RedisService = require('./services/redis.service');
const Metrics = require('./services/metrics.service');
const APP_VERSION = require('../package.json').version;

function secureTokenEqual(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireOpsToken(req, res, next) {
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const candidate = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!config.METRICS_TOKEN || !secureTokenEqual(candidate, config.METRICS_TOKEN)) {
    return res.status(404).json({ error: 'Route non trouvée' });
  }
  return next();
}

// Middleware RequestId & Observabilité (MM-INF-091)
app.use((req, res, next) => {
  req.id = typeof req.headers['x-request-id'] === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(req.headers['x-request-id']) ? req.headers['x-request-id'] : crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  const start = Date.now();
  const finishMetric = Metrics.begin(req.method);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    finishMetric(res.statusCode, durationMs);
    if (process.env.LOG_FORMAT === 'json' || isProd) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.userId || req.user?.id || undefined,
      }));
    }
  });
  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Origine refusée: ${origin}`);
    return callback(new Error('Origine non autorisée par CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Request-ID', 'X-Order-Token'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'X-Request-ID'],
  optionsSuccessStatus: 200,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Never allow browsers or intermediaries to cache authenticated/financial responses.
app.use((req, res, next) => {
  if (/^\/api\/(?:auth|account|admin|dashboard|payment|sellers\/me|internal)\b/.test(req.path)) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

const globalLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  skip: (req) => req.path.startsWith('/health') || /^\/api\/payment\/(webhook\/|notify\/)/.test(req.path),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives d’authentification' },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes de paiement' },
});

app.use(globalLimiter);

// Corps brut pour vérification HMAC des webhooks (AVANT express.json)
app.use('/api/payment/webhook/stripe', express.raw({ type: 'application/json' }));
app.use('/api/payment/webhook/paystack', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/auth', (req, res, next) => ['POST'].includes(req.method) && /^(\/login|\/signup|\/signup-seller|\/forgot-password|\/reset-password|\/resend-verification|\/verify-email)$/.test(req.path) ? authLimiter(req, res, next) : next(), authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/account/login', authLimiter);
app.use('/api/account/register', authLimiter);
app.use('/api/account', accountRoutes);
app.use('/api/payment', (req, res, next) => /^\/(webhook\/|notify\/)/.test(req.path) ? next() : paymentLimiter(req, res, next), paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', contactRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'MandeMarket API opérationnelle',
    version: APP_VERSION,
    ...(isProd ? {} : { environment: process.env.NODE_ENV || 'development' }),
    timestamp: new Date().toISOString(),
  });
});

// Healthchecks (MM-INF-092)
// Liveness probe (processus Node actif)
app.get('/health/live', (req, res) => {
  res.json({
    status: 'LIVE',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
  });
});

async function getDependencyStatus() {
  let database = 'DISCONNECTED';
  let redis = process.env.REDIS_URL ? 'DISCONNECTED' : 'NOT_CONFIGURED';
  try {
    await db.$queryRaw`SELECT 1`;
    database = 'CONNECTED';
  } catch {
    database = 'DISCONNECTED';
  }
  if (process.env.REDIS_URL) {
    redis = await RedisService.ping() ? 'CONNECTED' : 'DISCONNECTED';
  }
  return { database, redis, healthy: database === 'CONNECTED' && redis !== 'DISCONNECTED' };
}

// Public readiness returns only what a load balancer needs.
app.get('/health/ready', async (req, res) => {
  const status = await getDependencyStatus();
  res.status(status.healthy ? 200 : 503).json({
    status: status.healthy ? 'READY' : 'NOT_READY',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    ...(!isProd ? { database: status.database, redis: status.redis } : {}),
  });
});

// Detailed integration status is operational data and requires the monitoring token.
app.get('/health/external', requireOpsToken, (req, res) => {
  res.json({
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    cinetpay: Boolean(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID),
    paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
    cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    email: Boolean(process.env.SMTP_HOST),
  });
});

app.get('/api/internal/health', requireOpsToken, async (req, res) => {
  const status = await getDependencyStatus();
  res.status(status.healthy ? 200 : 503).json({
    ...status,
    version: APP_VERSION,
    uptime: process.uptime(),
    integrations: {
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      cinetpay: Boolean(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID),
      paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
      cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
      email: Boolean(process.env.SMTP_HOST),
    },
  });
});

app.get('/api/internal/metrics', requireOpsToken, (req, res) => {
  res.type('text/plain; version=0.0.4; charset=utf-8').send(Metrics.render());
});

// Health standard pour rétro-compatibilité Docker
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
  });
});

app.use((err, req, res, next) => {
  if (err?.message === 'Origine non autorisée par CORS') {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }
  console.error(err.stack || err);
  res.status(err.statusCode || 500).json({
    error: 'Une erreur interne s\'est produite',
    message: isProd ? 'Erreur serveur' : err.message,
    requestId: req.id,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path,
  });
});

if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`MandeMarket Backend v2.0 — port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
  const shutdown = () => {
    const deadline = setTimeout(() => process.exit(1), 25000).unref();
    server.close(async () => {
      await db.$disconnect();
      RedisService.getClient()?.disconnect();
      clearTimeout(deadline);
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

module.exports = app;
