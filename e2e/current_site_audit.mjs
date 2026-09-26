#!/usr/bin/env node

/**
 * Non-destructive browser audit for the locally seeded Docker stack.
 *
 * Usage:
 *   PLAYWRIGHT_CORE_PATH=/path/to/playwright-core node e2e/current_site_audit.mjs
 *
 * Credentials can be overridden through QA_* environment variables. Results are
 * written to qa-results/current-site-audit.json (ignored by git).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE_PATH;
if (!playwrightPath) throw new Error('PLAYWRIGHT_CORE_PATH is required');
const { chromium } = require(playwrightPath);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.QA_BASE_URL || 'http://localhost:3000';
const API = process.env.QA_API_URL || 'http://localhost:4002';
const CHROME = process.env.QA_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const credentials = {
  client: [process.env.QA_CLIENT_EMAIL || 'client@mandemarket.com', process.env.QA_CLIENT_PASSWORD || 'Client@2024!'],
  seller: [process.env.QA_SELLER_EMAIL || 'vendeur@mandemarket.com', process.env.QA_SELLER_PASSWORD || 'Vendeur@2024!'],
  admin: [process.env.QA_ADMIN_EMAIL || 'admin@mandemarket.com', process.env.QA_ADMIN_PASSWORD || 'Admin@2024!'],
};

const result = {
  startedAt: new Date().toISOString(),
  base: BASE,
  api: API,
  health: {},
  logins: {},
  roles: {},
  mobile: {},
  links: {},
  totals: {},
};

const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();
const uniq = (values) => [...new Set(values)];
const publicApiCache = new Map();

async function cachePublicApi(context) {
  for (const endpoint of ['/api/products?limit=500', '/api/categories']) {
    await context.route(`${API}${endpoint}`, async (route) => {
      if (!publicApiCache.has(endpoint)) {
        const response = await route.fetch();
        publicApiCache.set(endpoint, {
          status: response.status(),
          headers: response.headers(),
          body: await response.body(),
        });
      }
      await route.fulfill(publicApiCache.get(endpoint));
    });
  }
}

async function cachePrivateApi(context, endpoint) {
  let cached;
  await context.route(`${API}${endpoint}`, async (route) => {
    if (!cached) {
      const response = await route.fetch();
      cached = { status: response.status(), headers: response.headers(), body: await response.body() };
    }
    await route.fulfill(cached);
  });
}

async function appRoutes() {
  const root = path.join(ROOT, 'frontend', 'app');
  const pages = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) pages.push(full);
    }
  }
  await walk(root);
  return pages.map((file) => {
    let route = path.relative(root, path.dirname(file)).split(path.sep).join('/');
    route = route ? `/${route}` : '/';
    return route;
  }).sort();
}

async function apiJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function login(context, kind) {
  const page = await context.newPage();
  const [email, password] = credentials[kind];
  const staff = kind !== 'client';
  await page.goto(`${BASE}${staff ? '/admin/login' : '/compte/login'}`, { waitUntil: 'domcontentloaded' });
  // The form can be painted before React has attached its submit handler.
  await page.waitForTimeout(600);
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Se connecter', exact: true }) });
  await form.locator('input[type=email]').fill(email);
  await form.locator('input[type=password]').fill(password);
  const loginResponses = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.url().endsWith('/login')) loginResponses.push(response.status());
  });
  await form.getByRole('button', { name: 'Se connecter', exact: true }).click();
  const key = staff ? 'admin_token' : 'mandemarket_customer_token';
  await page.waitForFunction((storageKey) => Boolean(sessionStorage.getItem(storageKey)), key, { timeout: 8_000 }).catch(() => {});
  const stored = await page.evaluate((storageKey) => ({
    token: sessionStorage.getItem(storageKey),
    user: sessionStorage.getItem('admin_user'),
  }), key);
  const token = stored.token;
  result.logins[kind] = {
    browserForm: Boolean(token),
    responses: loginResponses,
    finalUrl: page.url(),
    message: token ? '' : normalizeText(await page.locator('[role=alert], .text-red-500, .text-red-600').allTextContents().then((items) => items.join(' ')).catch(() => '')),
  };
  if (token) {
    await context.addInitScript(({ storageKey, value, user }) => {
      sessionStorage.setItem(storageKey, value);
      if (user) sessionStorage.setItem('admin_user', user);
    }, { storageKey: key, value: token, user: stored.user });
  }
  if (!token) {
    const endpoint = staff ? '/api/auth/login' : '/api/account/login';
    const response = await context.request.post(`${API}${endpoint}`, { data: { email, password } });
    const data = await response.json();
    const accessToken = data.token || data.accessToken;
    if (!response.ok() || !accessToken) throw new Error(`Unable to authenticate ${kind}: ${response.status()} ${JSON.stringify(data)}`);
    await context.addInitScript(({ storageKey, value, user }) => {
      sessionStorage.setItem(storageKey, value);
      if (user) sessionStorage.setItem('admin_user', JSON.stringify(user));
    }, { storageKey: key, value: accessToken, user: data.user || null });
    result.logins[kind].fallbackApi = true;
  }
  await page.close();
}

function routeOwner(route) {
  if (route.startsWith('/vendeur/dashboard')) return 'seller';
  if (route === '/admin' || route === '/admin/dashboard') return 'admin';
  if (route.startsWith('/compte/dashboard') || route.startsWith('/compte/commandes')) return 'client';
  return 'public';
}

function resolveDynamicRoutes(routes, products, clientOrders) {
  const resolved = [];
  for (const route of routes) {
    if (route === '/boutique/[id]') {
      for (const product of products.slice(0, 3)) resolved.push(`/boutique/${product.id}`);
    } else if (route === '/blog/[id]') {
      for (const id of [1, 2, 3, 4]) resolved.push(`/blog/${id}`);
    } else if (route === '/vendeur/[slug]') {
      resolved.push('/vendeur/boutique-aminata');
    } else if (route === '/vendeur/dashboard/produits/[id]') {
      for (const product of products.filter((item) => item.sellerId).slice(0, 2)) resolved.push(`/vendeur/dashboard/produits/${product.id}`);
    } else if (route === '/compte/commandes/[id]') {
      if (clientOrders.length) {
        for (const order of clientOrders.slice(0, 2)) resolved.push(`/compte/commandes/${order.id}`);
      } else {
        resolved.push('/compte/commandes/00000000-0000-4000-8000-000000000000');
      }
    } else if (route === '/commande/[id]') {
      resolved.push('/commande/00000000-0000-4000-8000-000000000000');
    } else {
      resolved.push(route);
    }
  }
  return uniq(resolved);
}

const safeButton = /^(menu|fermer|close|voir|aperçu|ouvrir|retour|précédent|suivant|[0-9]+|copier|réinitialiser|afficher|masquer)/i;
const unsafeButton = /(supprimer|déconnecter|confirmer|payer|commander|annuler|rembourser|retirer|enregistrer|envoyer|publier|suspendre|désactiver|dupliquer|créer|ajouter|importer|exporter|upload|télécharger|photo|image|logo|mot de passe)/i;

async function auditRoute(context, role, route, viewport = null) {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  const record = {
    route,
    finalUrl: null,
    status: null,
    title: null,
    heading: null,
    buttons: [],
    deadControls: [],
    badLinks: [],
    errors: [],
    clicks: [],
    internalLinks: [],
    viewport,
    horizontalOverflow: null,
  };
  let phase = 'load';
  const networkSignals = [];
  page.on('pageerror', (error) => record.errors.push(`pageerror [${phase}] ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') record.errors.push(`console [${phase}] ${normalizeText(message.text())}`);
  });
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(BASE) || request.url().startsWith(API)) {
      const failure = request.failure()?.errorText || '';
      // Next.js intentionally aborts in-flight RSC prefetches when the audit
      // navigates away or closes a page; these are not application failures.
      if (request.url().includes('_rsc=') && failure.includes('ERR_ABORTED')) return;
      record.errors.push(`requestfailed [${phase}] ${request.method()} ${request.url()} ${failure}`);
    }
  });
  page.on('response', (response) => {
    if ((response.url().startsWith(BASE) || response.url().startsWith(API)) && response.status() >= 400) {
      const signal = `HTTP ${response.status()} [${phase}] ${response.request().method()} ${response.url().split('?')[0]}`;
      networkSignals.push(signal);
      if (response.status() >= 500) record.errors.push(signal);
    }
  });
  try {
    const response = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    record.status = response?.status() ?? null;
    await page.waitForTimeout(800);
    record.finalUrl = page.url();
    record.title = await page.title();
    record.heading = normalizeText(await page.locator('h1').first().textContent().catch(() => ''));
    record.horizontalOverflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));

    const buttons = page.locator('button:visible, [role=button]:visible');
    const buttonCount = await buttons.count();
    for (let index = 0; index < Math.min(buttonCount, 80); index += 1) {
      const button = buttons.nth(index);
      const info = await button.evaluate((element) => ({
        tag: element.tagName.toLowerCase(),
        text: (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').replace(/\s+/g, ' ').trim(),
        type: element.getAttribute('type') || '',
        disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
        href: element.getAttribute('href') || '',
      })).catch(() => null);
      if (!info) continue;
      record.buttons.push(info);
      if (!info.text) record.deadControls.push(`Bouton sans nom accessible #${index + 1}`);
      if (info.tag === 'a' && (!info.href || info.href === '#' || info.href.startsWith('javascript:'))) {
        record.deadControls.push(`Lien-bouton sans destination: ${info.text || `#${index + 1}`}`);
      }
    }

    const links = await page.locator('a[href]').evaluateAll((elements) => elements.map((element) => ({
      text: (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').replace(/\s+/g, ' ').trim(),
      href: element.getAttribute('href') || '',
    })));
    for (const link of links) {
      if (!link.href || link.href === '#' || /^javascript:/i.test(link.href)) {
        record.badLinks.push(`${link.text || '(sans nom)'} -> ${link.href || '(vide)'}`);
        continue;
      }
      try {
        const url = new URL(link.href, BASE);
        if (url.origin === new URL(BASE).origin) record.internalLinks.push(url.pathname + url.search);
      } catch {
        record.badLinks.push(`${link.text || '(sans nom)'} -> ${link.href}`);
      }
    }

    // Exercise safe, non-submit controls. A click is considered observable when
    // it changes navigation/DOM/expanded state/storage or triggers a request.
    const candidates = record.buttons
      .map((button, index) => ({ ...button, index }))
      .filter((button) => !button.disabled && button.type !== 'submit' && safeButton.test(button.text) && !unsafeButton.test(button.text))
      .slice(0, 8);
    for (const candidate of candidates) {
      phase = `click:${candidate.text}`;
      const current = page.locator('button:visible, [role=button]:visible').nth(candidate.index);
      if (!(await current.count())) continue;
      const before = await page.evaluate(() => ({
        url: location.href,
        text: document.body.innerText,
        storage: JSON.stringify({ ...localStorage, ...sessionStorage }),
        expanded: Array.from(document.querySelectorAll('[aria-expanded]')).map((node) => node.getAttribute('aria-expanded')).join(','),
        pressed: Array.from(document.querySelectorAll('[aria-pressed]')).map((node) => node.getAttribute('aria-pressed')).join(','),
      }));
      const signalStart = networkSignals.length;
      let clickError = '';
      await current.click({ timeout: 3_000 }).catch((error) => { clickError = error.message.split('\n')[0]; });
      await page.waitForTimeout(450);
      const after = await page.evaluate(() => ({
        url: location.href,
        text: document.body.innerText,
        storage: JSON.stringify({ ...localStorage, ...sessionStorage }),
        expanded: Array.from(document.querySelectorAll('[aria-expanded]')).map((node) => node.getAttribute('aria-expanded')).join(','),
        pressed: Array.from(document.querySelectorAll('[aria-pressed]')).map((node) => node.getAttribute('aria-pressed')).join(','),
      })).catch(() => before);
      const signals = [];
      if (before.url !== after.url) signals.push('navigation');
      if (before.text !== after.text) signals.push('dom');
      if (before.storage !== after.storage) signals.push('storage');
      if (before.expanded !== after.expanded) signals.push('aria-expanded');
      if (before.pressed !== after.pressed) signals.push('aria-pressed');
      if (networkSignals.length > signalStart) signals.push('network');
      record.clicks.push({ name: candidate.text, signals, error: clickError || undefined });
      if (!clickError && signals.length === 0) record.deadControls.push(`Clic sans effet observable: ${candidate.text}`);
      if (after.url !== `${BASE}${route}`) break;
    }
    record.errors.push(...networkSignals.filter((signal) =>
      /HTTP 404/.test(signal)
      && !/\/api\/orders\/reference\//.test(signal)
      && !/\/api\/account\/orders\/00000000-0000-4000-8000-000000000000/.test(signal)
    ));
  } catch (error) {
    record.errors.push(`audit ${error.message}`);
  } finally {
    await page.close();
  }
  if (route.includes('00000000-0000-4000-8000-000000000000')) {
    // Dynamic order routes need a fixture. When the seed has no order, the
    // deliberate unknown UUID must render a clean not-found/unauthorised state.
    record.errors = record.errors.filter((entry) => !/^console .*status of (401|404)/.test(entry));
  }
  record.internalLinks = uniq(record.internalLinks);
  record.errors = uniq(record.errors);
  record.deadControls = uniq(record.deadControls);
  return record;
}

async function tokenFromContext(context, key) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const value = await page.evaluate((storageKey) => sessionStorage.getItem(storageKey), key);
  await page.close();
  return value;
}

async function main() {
  result.health.frontend = await fetch(BASE).then((response) => response.status).catch((error) => error.message);
  result.health.backend = await fetch(`${API}/health`).then((response) => response.status).catch((error) => error.message);
  const sourceRoutes = await appRoutes();
  const productPayload = await apiJson(`${API}/api/products?limit=20`);
  const products = productPayload.products || productPayload.data || [];

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const contexts = {};
  for (const role of ['public', 'client', 'seller', 'admin']) {
    contexts[role] = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 1000 } });
    await cachePublicApi(contexts[role]);
    if (role !== 'public') {
      await login(contexts[role], role);
      if (role === 'seller') await cachePrivateApi(contexts[role], '/api/sellers/me/profile');
      if (role === 'client') await cachePrivateApi(contexts[role], '/api/account/me');
    }
  }

  const firstProduct = products[0]?.id;
  const mobileTargets = {
    public: ['/', '/boutique', ...(firstProduct ? [`/boutique/${firstProduct}`] : []), '/panier'],
    client: ['/compte/dashboard'],
    seller: ['/vendeur/dashboard', '/vendeur/dashboard/produits'],
    admin: ['/admin/dashboard'],
  };
  for (const [role, targets] of Object.entries(mobileTargets)) {
    result.mobile[role] = [];
    for (const route of targets) {
      result.mobile[role].push(await auditRoute(contexts[role], role, route, { width: 390, height: 844 }));
    }
  }
  const clientToken = await tokenFromContext(contexts.client, 'mandemarket_customer_token');
  const clientOrdersPayload = await apiJson(`${API}/api/account/orders`, { headers: { Authorization: `Bearer ${clientToken}` } }).catch(() => ({ orders: [] }));
  const clientOrders = clientOrdersPayload.orders || clientOrdersPayload.data || [];
  const routes = resolveDynamicRoutes(sourceRoutes, products, clientOrders);

  for (const role of ['public', 'client', 'seller', 'admin']) {
    const owned = routes.filter((route) => routeOwner(route) === role);
    result.roles[role] = [];
    for (const route of owned) {
      process.stdout.write(`[${role}] ${route}\n`);
      result.roles[role].push(await auditRoute(contexts[role], role, route));
    }
  }

  const discovered = uniq(Object.values(result.roles).flat().flatMap((record) => record.internalLinks));
  const linkContext = contexts.public;
  const linkChecks = [];
  for (const href of discovered) {
    if (/^\/(api|uploads)\//.test(href) || href.includes('#')) continue;
    const response = await linkContext.request.get(`${BASE}${href}`, { timeout: 10_000, failOnStatusCode: false }).catch((error) => ({ status: () => 0, statusText: () => error.message }));
    const status = response.status();
    if (status >= 400 || status === 0) linkChecks.push({ href, status, detail: response.statusText() });
  }
  result.links.discovered = discovered.length;
  result.links.failures = linkChecks;
  for (const context of Object.values(contexts)) await context.close();
  await browser.close();

  const all = Object.values(result.roles).flat();
  result.totals = {
    sourceRoutes: sourceRoutes.length,
    resolvedRoutes: routes.length,
    auditedRoutes: all.length,
    buttons: all.reduce((sum, record) => sum + record.buttons.length, 0),
    clicks: all.reduce((sum, record) => sum + record.clicks.length, 0),
    routeErrors: all.filter((record) => record.errors.length).length,
    deadControlFindings: all.reduce((sum, record) => sum + record.deadControls.length, 0),
    badLinkFindings: all.reduce((sum, record) => sum + record.badLinks.length, 0),
    failedLinks: linkChecks.length,
    mobileAudits: Object.values(result.mobile).flat().length,
    mobileOverflow: Object.values(result.mobile).flat().filter((record) => record.horizontalOverflow?.overflowing).length,
  };
  result.finishedAt = new Date().toISOString();
  const out = path.join(ROOT, 'qa-results', 'current-site-audit.json');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result.totals, null, 2));
  console.log(out);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
