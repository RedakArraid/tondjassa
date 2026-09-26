#!/usr/bin/env node

/** Focused, non-destructive acceptance checks for the local Docker stack. */
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
const report = { startedAt: new Date().toISOString(), checks: [], unexpectedErrors: [] };

async function check(name, fn) {
  try {
    const detail = await fn();
    report.checks.push({ name, pass: true, detail });
    process.stdout.write(`PASS ${name}: ${JSON.stringify(detail)}\n`);
  } catch (error) {
    report.checks.push({ name, pass: false, detail: error.message });
    process.stdout.write(`FAIL ${name}: ${error.message}\n`);
  }
}

function monitor(page, label) {
  page.on('pageerror', (error) => report.unexpectedErrors.push(`${label} pageerror ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/^Failed to load resource: the server responded with a status of 404/.test(message.text())) {
      report.unexpectedErrors.push(`${label} console ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || '';
    if (request.url().includes('_rsc=') && failure.includes('ERR_ABORTED')) return;
    if (failure.includes('ERR_ABORTED') && request.url().includes('/api/checkout/')) return;
    report.unexpectedErrors.push(`${label} requestfailed ${request.method()} ${request.url()} ${failure}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500 && (response.url().startsWith(BASE) || response.url().startsWith(API))) {
      report.unexpectedErrors.push(`${label} HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
}

async function loginStaff(context, email, password) {
  const page = await context.newPage();
  monitor(page, 'admin-login');
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  // Client components can be visible before React has attached submit handlers.
  await page.waitForTimeout(600);
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  const response = await responsePromise;
  await page.waitForFunction(() => Boolean(sessionStorage.getItem('admin_token')));
  const stored = await page.evaluate(() => ({
    token: sessionStorage.getItem('admin_token'),
    user: sessionStorage.getItem('admin_user'),
  }));
  await context.addInitScript(({ token, user }) => {
    sessionStorage.setItem('admin_token', token);
    sessionStorage.setItem('admin_user', user);
  }, stored);
  await page.close();
  return response.status();
}

async function loginClient(context, email, password) {
  const page = await context.newPage();
  monitor(page, 'client-login');
  await page.goto(`${BASE}/compte/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Se connecter', exact: true }) });
  await form.locator('input[type=email]').fill(email);
  await form.locator('input[type=password]').fill(password);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/account/login'));
  await form.getByRole('button', { name: 'Se connecter', exact: true }).click();
  const response = await responsePromise;
  await page.waitForFunction(() => Boolean(sessionStorage.getItem('mandemarket_customer_token')));
  await page.close();
  return response.status();
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ locale: 'fr-FR', acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  monitor(page, 'public-flow');

  await check('newsletter inscription', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const email = `qa.browser.${Date.now()}@example.com`;
    const newsletter = page.locator('section').filter({ hasText: 'Ne manquez aucune nouveauté' }).locator('form');
    await newsletter.getByPlaceholder('Votre adresse e-mail').fill(email);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/newsletter/subscribe'));
    await newsletter.getByRole('button', { name: "S’inscrire" }).click();
    const response = await responsePromise;
    const message = await page.getByRole('status').textContent();
    if (response.status() !== 200 || !/confirmée/i.test(message || '')) throw new Error(`status=${response.status()} message=${message}`);
    return { status: response.status(), message, email };
  });

  await check('suivi erreur métier', async () => {
    await page.goto(`${BASE}/suivi`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder(/Ex: LD-AF/).fill('QA-TRACKING-INCONNU');
    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/shipping/track/'));
    await page.getByRole('button', { name: 'Suivre mon colis' }).click();
    const response = await responsePromise;
    await page.waitForTimeout(250);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    if (page.url() !== `${BASE}/suivi` || !/introuvable|trouvé|suivi/i.test(body)) throw new Error(`url=${page.url()} status=${response.status()}`);
    return { pageStatus: 200, apiStatus: response.status(), stayedOnTrackingPage: true };
  });

  await check('filtres boutique', async () => {
    await page.goto(`${BASE}/boutique`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const search = page.getByPlaceholder('Rechercher un produit (nom, description)...');
    await search.fill('Karité');
    await page.waitForTimeout(850);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    if (!body.includes('Karité pur beurre 250g')) throw new Error('Le filtre texte ne montre pas le produit attendu');
    const sort = page.locator('select').first();
    const options = await sort.locator('option').evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, label: node.textContent })));
    const current = await sort.inputValue();
    const alternate = options.find((option) => option.value && option.value !== current);
    if (alternate) await sort.selectOption(alternate.value);
    if ((await search.inputValue()) !== 'Karité') throw new Error('Le filtre a perdu la recherche saisie');
    return { search: 'Karité', productVisible: true, sortSelected: alternate?.value || null };
  });

  await check('favori produit', async () => {
    await page.goto(`${BASE}/boutique/12`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('mandemarket_wishlist'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ajouter aux favoris' }).click();
    const stored = await page.evaluate(() => localStorage.getItem('mandemarket_wishlist'));
    const renamed = await page.getByRole('button', { name: 'Retirer des favoris' }).count();
    if (!stored?.includes('12') || renamed !== 1) throw new Error(`storage=${stored} renamed=${renamed}`);
    return { productId: 12, storage: stored, accessibleStateChanged: true };
  });

  await check('panier puis promo checkout', async () => {
    const add = page.getByRole('button', { name: /Ajouter au panier/i }).first();
    await add.click();
    const cartStorage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /cart/i.test(key))));
    if (!Object.values(cartStorage).some((value) => String(value).includes('Karité'))) throw new Error(`panier non persisté: ${JSON.stringify(cartStorage)}`);
    await page.goto(`${BASE}/panier`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Code promo').fill('QA-INVALIDE');
    await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
    const cartMessage = await page.getByRole('status').textContent();
    const pending = await page.evaluate(() => sessionStorage.getItem('mm_pending_promo'));
    const quotePromise = page.waitForResponse((response) => response.url().endsWith('/api/checkout/quote') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Passer la commande/ }).click();
    await page.waitForURL('**/checkout');
    await quotePromise;
    await page.getByText('Ce code promo n’est pas valide pour ce panier.').waitFor({ timeout: 8_000 });
    if (pending !== 'QA-INVALIDE') throw new Error(`promo panier non transmise: ${pending}`);
    return { cartPersisted: true, cartMessage, pendingPromo: pending, invalidPromoHandled: true, checkoutUrl: page.url() };
  });

  const clientContext = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 1000 } });
  await check('login client ciblé', async () => ({ status: await loginClient(clientContext, 'client@mandemarket.com', 'Client@2024!') }));

  const adminContext = await browser.newContext({ locale: 'fr-FR', acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  await check('admin login eye accessible', async () => {
    const loginPage = await adminContext.newPage();
    await loginPage.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
    const eye = loginPage.getByRole('button', { name: 'Afficher le mot de passe' });
    const count = await eye.count();
    if (count !== 1 || await eye.getAttribute('aria-pressed') !== 'false') throw new Error(`count=${count}`);
    await eye.click();
    const renamed = await loginPage.getByRole('button', { name: 'Masquer le mot de passe' }).count();
    await loginPage.close();
    if (renamed !== 1) throw new Error('Le libellé ne suit pas l’état');
    return { named: true, stateExposed: true };
  });
  await check('login admin ciblé', async () => ({ status: await loginStaff(adminContext, 'admin@mandemarket.com', 'Admin@2024!') }));
  const adminPage = await adminContext.newPage();
  monitor(adminPage, 'admin-flow');
  await adminPage.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await adminPage.getByText('Statistiques des ventes').waitFor({ timeout: 10_000 }).catch(() => {});

  await check('export CSV admin', async () => {
    const button = adminPage.getByRole('button', { name: 'Exporter les données de vente en CSV' });
    await button.waitFor({ timeout: 10_000 });
    const downloadPromise = adminPage.waitForEvent('download');
    await button.click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let bytes = 0;
    for await (const chunk of stream) bytes += chunk.length;
    if (!download.suggestedFilename().endsWith('.csv') || bytes < 20) throw new Error(`filename=${download.suggestedFilename()} bytes=${bytes}`);
    return { filename: download.suggestedFilename(), bytes };
  });

  await check('périodes graphiques admin effectives', async () => {
    const daily = adminPage.getByRole('button', { name: '7 jours' });
    const monthly = adminPage.getByRole('button', { name: '12 mois' });
    const dailyBefore = await daily.getAttribute('class');
    await monthly.click();
    const monthlyAfter = await monthly.getAttribute('class');
    const dailyAfter = await daily.getAttribute('class');
    if (!dailyBefore?.includes('bg-white') || !monthlyAfter?.includes('bg-white') || dailyAfter?.includes('bg-white')) {
      throw new Error(`dailyBefore=${dailyBefore} monthlyAfter=${monthlyAfter} dailyAfter=${dailyAfter}`);
    }
    const downloadPromise = adminPage.waitForEvent('download');
    await adminPage.getByRole('button', { name: 'Exporter les données de vente en CSV' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let bytes = 0;
    for await (const chunk of stream) bytes += chunk.length;
    if (!download.suggestedFilename().includes('monthly') || bytes < 20) throw new Error(`filename=${download.suggestedFilename()} bytes=${bytes}`);
    return { dailyInitiallyActive: true, monthlyActiveAfterClick: true, monthlyExport: download.suggestedFilename(), bytes };
  });

  await check('alerte admin marquée lue', async () => {
    const mark = adminPage.getByRole('button', { name: /Marquer l’alerte .* comme lue/ }).first();
    await mark.waitFor({ timeout: 10_000 });
    const name = await mark.getAttribute('aria-label');
    const before = await adminPage.getByRole('button', { name: /Marquer l’alerte .* comme lue/ }).count();
    await mark.click();
    const after = await adminPage.getByRole('button', { name: /Marquer l’alerte .* comme lue/ }).count();
    if (after !== before - 1) throw new Error(`before=${before} after=${after}`);
    return { action: name, unreadBefore: before, unreadAfter: after, localOnly: true };
  });

  await check('admin dashboard mobile sans débordement', async () => {
    const mobile = await adminContext.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await mobile.getByText('Dashboard Analytics').waitFor({ timeout: 10_000 });
    const dimensions = await mobile.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    await mobile.close();
    if (dimensions.scrollWidth > dimensions.clientWidth + 2) throw new Error(JSON.stringify(dimensions));
    return dimensions;
  });

  const sellerContext = await browser.newContext({ locale: 'fr-FR', acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  await check('login vendeur ciblé', async () => ({ status: await loginStaff(sellerContext, 'vendeur@mandemarket.com', 'Vendeur@2024!') }));
  const sellerPage = await sellerContext.newPage();
  monitor(sellerPage, 'seller-flow');

  await check('aperçu boutique vendeur', async () => {
    await sellerPage.goto(`${BASE}/vendeur/dashboard/boutique/apparence`, { waitUntil: 'domcontentloaded' });
    const link = sellerPage.getByRole('link', { name: /Prévisualiser ma boutique/ });
    await link.waitFor({ timeout: 10_000 });
    const href = await link.getAttribute('href');
    const response = await sellerContext.request.get(`${BASE}${href}`, { failOnStatusCode: false });
    if (href !== '/vendeur/boutique-aminata' || response.status() !== 200) throw new Error(`href=${href} status=${response.status()}`);
    return { href, status: response.status() };
  });

  await check('switches notifications nommés', async () => {
    await sellerPage.goto(`${BASE}/vendeur/dashboard/parametres/notifications`, { waitUntil: 'domcontentloaded' });
    const switches = sellerPage.getByRole('switch');
    await switches.first().waitFor({ timeout: 10_000 });
    const count = await switches.count();
    const names = await switches.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || ''));
    if (count !== 8 || names.some((name) => !name)) throw new Error(`count=${count} names=${JSON.stringify(names)}`);
    return { count, names };
  });

  await check('périodes statistiques vendeur effectives', async () => {
    await sellerPage.goto(`${BASE}/vendeur/dashboard/statistiques`, { waitUntil: 'domcontentloaded' });
    await sellerPage.getByText('Statistiques des ventes').waitFor({ timeout: 10_000 });
    await sellerPage.getByRole('button', { name: '3 mois' }).click();
    const threeMonths = await sellerPage.getByText('Volume brut · 3 mois').count();
    await sellerPage.getByRole('button', { name: 'Toutes périodes' }).click();
    const allTime = await sellerPage.getByText('Volume brut · Toutes périodes').count();
    if (threeMonths !== 1 || allTime !== 1) throw new Error(`3mois=${threeMonths} all=${allTime}`);
    return { threeMonths: true, allTime: true };
  });

  await check('filtres avis vendeur effectifs', async () => {
    await sellerPage.goto(`${BASE}/vendeur/dashboard/communication/avis`, { waitUntil: 'domcontentloaded' });
    const fourStars = sellerPage.getByRole('button', { name: '4 étoiles' });
    await fourStars.waitFor({ timeout: 10_000 });
    await fourStars.click();
    const fourPressed = await fourStars.getAttribute('aria-pressed');
    const allPressed = await sellerPage.getByRole('button', { name: 'Tous', exact: true }).getAttribute('aria-pressed');
    if (fourPressed !== 'true' || allPressed !== 'false') throw new Error(`four=${fourPressed} all=${allPressed}`);
    return { fourStarsPressed: true, allReleased: true };
  });

  report.unexpectedErrors = [...new Set(report.unexpectedErrors)];
  report.finishedAt = new Date().toISOString();
  report.summary = {
    passed: report.checks.filter((item) => item.pass).length,
    failed: report.checks.filter((item) => !item.pass).length,
    unexpectedErrors: report.unexpectedErrors.length,
  };
  await context.close();
  await clientContext.close();
  await adminContext.close();
  await sellerContext.close();
  await browser.close();
  const out = path.join(ROOT, 'qa-results', 'current-site-flows.json');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report.summary)}\n${out}\n`);
  if (report.summary.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
