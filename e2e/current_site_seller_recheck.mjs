#!/usr/bin/env node

/** Five isolated seller checks, intended for post-restart rate-limit validation. */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE_PATH;
if (!playwrightPath) throw new Error('PLAYWRIGHT_CORE_PATH is required');
const { chromium } = require(playwrightPath);

const BASE = process.env.QA_BASE_URL || 'http://localhost:3000';
const CHROME = process.env.QA_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, pass: true, detail });
    process.stdout.write(`PASS ${name}: ${JSON.stringify(detail)}\n`);
  } catch (error) {
    checks.push({ name, pass: false, detail: error.message });
    process.stdout.write(`FAIL ${name}: ${error.message}\n`);
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 1000 } });

await check('login vendeur', async () => {
  const page = await context.newPage();
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.getByLabel('Adresse email').fill('vendeur@mandemarket.com');
  await page.getByLabel('Mot de passe', { exact: true }).fill('Vendeur@2024!');
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  const response = await responsePromise;
  await page.waitForFunction(() => Boolean(sessionStorage.getItem('admin_token')));
  const stored = await page.evaluate(() => ({ token: sessionStorage.getItem('admin_token'), user: sessionStorage.getItem('admin_user') }));
  await context.addInitScript(({ token, user }) => {
    sessionStorage.setItem('admin_token', token);
    sessionStorage.setItem('admin_user', user);
  }, stored);
  await page.close();
  if (response.status() !== 200) throw new Error(`HTTP ${response.status()}`);
  return { status: response.status() };
});

const page = await context.newPage();
const runtimeErrors = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 500 && response.url().startsWith('http://localhost')) runtimeErrors.push(`HTTP ${response.status()} ${response.url()}`);
});

await check('aperçu boutique', async () => {
  await page.goto(`${BASE}/vendeur/dashboard/boutique/apparence`, { waitUntil: 'domcontentloaded' });
  const link = page.getByRole('link', { name: /Prévisualiser ma boutique/ });
  await link.waitFor();
  const href = await link.getAttribute('href');
  const response = await context.request.get(`${BASE}${href}`, { failOnStatusCode: false });
  if (href !== '/vendeur/boutique-aminata' || response.status() !== 200) throw new Error(`href=${href} status=${response.status()}`);
  return { href, status: response.status() };
});

await check('switches notifications', async () => {
  await page.goto(`${BASE}/vendeur/dashboard/parametres/notifications`, { waitUntil: 'domcontentloaded' });
  const switches = page.getByRole('switch');
  await switches.first().waitFor();
  const names = await switches.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') || ''));
  if (names.length !== 8 || names.some((name) => !name)) throw new Error(JSON.stringify(names));
  return { count: names.length, allNamed: true };
});

await check('périodes statistiques', async () => {
  await page.goto(`${BASE}/vendeur/dashboard/statistiques`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '3 mois' }).click();
  const threeMonths = await page.getByText('Volume brut · 3 mois').count();
  await page.getByRole('button', { name: 'Toutes périodes' }).click();
  const allTime = await page.getByText('Volume brut · Toutes périodes').count();
  if (threeMonths !== 1 || allTime !== 1) throw new Error(`3mois=${threeMonths} all=${allTime}`);
  return { threeMonths: true, allTime: true };
});

await check('filtres avis', async () => {
  await page.goto(`${BASE}/vendeur/dashboard/communication/avis`, { waitUntil: 'domcontentloaded' });
  const fourStars = page.getByRole('button', { name: '4 étoiles' });
  await fourStars.click();
  const fourPressed = await fourStars.getAttribute('aria-pressed');
  const allPressed = await page.getByRole('button', { name: 'Tous', exact: true }).getAttribute('aria-pressed');
  if (fourPressed !== 'true' || allPressed !== 'false') throw new Error(`four=${fourPressed} all=${allPressed}`);
  return { fourStarsPressed: true, allReleased: true };
});

await context.close();
await browser.close();
const summary = { passed: checks.filter((item) => item.pass).length, failed: checks.filter((item) => !item.pass).length, runtimeErrors };
process.stdout.write(`${JSON.stringify(summary)}\n`);
if (summary.failed || runtimeErrors.length) process.exitCode = 1;
