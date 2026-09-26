#!/usr/bin/env node

/**
 * Recette locale non destructive des espaces client, admin, manager, support et
 * vendeur. Avec QA_MUTATE_SUPPORT=true, ajoute un ticket QA et ses réponses afin
 * de valider l'outbox et Mailpit. Aucun paiement ni suppression n'est exécuté.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE_PATH;
if (!playwrightPath) throw new Error('PLAYWRIGHT_CORE_PATH est requis');
const { chromium } = require(playwrightPath);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.QA_BASE_URL || 'http://localhost:3000';
const API = process.env.QA_API_URL || 'http://localhost:4002';
const MAILPIT = process.env.QA_MAILPIT_URL || 'http://localhost:8025';
const CHROME = process.env.QA_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MUTATE_SUPPORT = /^(1|true|yes)$/i.test(process.env.QA_MUTATE_SUPPORT || '');

const credentials = {
  client: [process.env.QA_CLIENT_EMAIL || 'client@mandemarket.com', process.env.QA_CLIENT_PASSWORD || 'Client@2024!'],
  admin: [process.env.QA_ADMIN_EMAIL || 'admin@mandemarket.com', process.env.QA_ADMIN_PASSWORD || 'Admin@2024!'],
  manager: [process.env.QA_MANAGER_EMAIL || 'manager@mandemarket.com', process.env.QA_MANAGER_PASSWORD || 'Manager@2024!'],
  support: [process.env.QA_SUPPORT_EMAIL || 'support@mandemarket.com', process.env.QA_SUPPORT_PASSWORD || 'Support@2024!'],
  seller: [process.env.QA_SELLER_EMAIL || 'vendeur@mandemarket.com', process.env.QA_SELLER_PASSWORD || 'Vendeur@2024!'],
};

const report = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE,
  apiUrl: API,
  supportMutationEnabled: MUTATE_SUPPORT,
  checks: [],
  browserErrors: [],
};

async function check(name, work) {
  try {
    const detail = await work();
    report.checks.push({ name, pass: true, detail });
    process.stdout.write(`PASS ${name}: ${JSON.stringify(detail)}\n`);
  } catch (error) {
    report.checks.push({ name, pass: false, detail: error.message });
    process.stdout.write(`FAIL ${name}: ${error.message}\n`);
  }
}

async function apiRequest(pathname, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(pathname, email, password) {
  const response = await apiRequest(pathname, { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200, `${pathname} (${email}) a répondu ${response.status}`);
  const token = response.data?.token || response.data?.accessToken;
  assert.ok(token, `Jeton absent pour ${email}`);
  return { token, user: response.data?.user || response.data?.customer };
}

async function expectStatus(tokens, role, pathname, expected, method = 'GET', body) {
  const response = await apiRequest(pathname, { method, token: tokens[role].token, body });
  assert.equal(response.status, expected, `${role} ${method} ${pathname}: ${response.status}, attendu ${expected}`);
  return response.status;
}

function monitor(page, label) {
  page.on('pageerror', (error) => report.browserErrors.push(`${label} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') report.browserErrors.push(`${label} console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText || '';
    if (reason.includes('ERR_ABORTED') && (request.url().includes('_rsc=') || request.url().includes('/api/checkout/'))) return;
    report.browserErrors.push(`${label} requestfailed: ${request.method()} ${request.url()} ${reason}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500 && (response.url().startsWith(BASE) || response.url().startsWith(API))) {
      report.browserErrors.push(`${label} HTTP ${response.status()}: ${response.url()}`);
    }
  });
}

async function assertResponsive(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 2, `débordement mobile ${JSON.stringify(dimensions)}`);
  return dimensions;
}

async function browserStaffLogin(browser, role, loginPath, expectedPath, marker, submitName) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  monitor(page, role);
  await page.goto(`${BASE}${loginPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.getByLabel('Adresse email').fill(credentials[role][0]);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials[role][1]);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: submitName, exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200, `login ${role}: ${response.status()}`);
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 15_000 });
  await page.getByText(marker, { exact: false }).first().waitFor({ timeout: 15_000 });
  const dimensions = await assertResponsive(page);
  const result = { status: response.status(), path: new URL(page.url()).pathname, dimensions };
  await context.close();
  return result;
}

async function browserClientLogin(browser) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  monitor(page, 'client');
  await page.goto(`${BASE}/compte/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Se connecter', exact: true }) });
  await form.locator('input[type=email]').fill(credentials.client[0]);
  await form.locator('input[type=password]').fill(credentials.client[1]);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/account/login'));
  await form.getByRole('button', { name: 'Se connecter', exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200, `login client: ${response.status()}`);
  await page.waitForURL((url) => url.pathname === '/compte/dashboard', { timeout: 15_000 });
  await page.getByText('Espace client MandeMarket', { exact: true }).waitFor({ timeout: 15_000 });
  const dimensions = await assertResponsive(page);
  const result = { status: response.status(), path: new URL(page.url()).pathname, dimensions };
  await context.close();
  return result;
}

async function openStaffPage(browser, role, loginPath, expectedPath, submitName) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  monitor(page, `${role}-actions`);
  await page.goto(`${BASE}${loginPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.getByLabel('Adresse email').fill(credentials[role][0]);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials[role][1]);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: submitName, exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 15_000 });
  return { context, page };
}

async function supportBrowserActions(browser, workflow) {
  const { context, page } = await openStaffPage(browser, 'support', '/support/login', '/support/dashboard', 'Accéder aux tickets');
  await page.getByText('Support MandeMarket', { exact: true }).first().waitFor({ timeout: 15_000 });
  await page.getByLabel('Rechercher un ticket').fill(workflow.reference);
  const searchPromise = page.waitForResponse((response) => response.url().includes('/api/support/tickets?') && response.url().includes('search='));
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  assert.equal((await searchPromise).status(), 200);
  const ticketButton = page.getByRole('button').filter({ hasText: workflow.reference }).first();
  await ticketButton.waitFor({ timeout: 10_000 });
  const detailPromise = page.waitForResponse((response) => response.url().endsWith(`/api/support/tickets/${workflow.id}`) && response.request().method() === 'GET');
  await ticketButton.click();
  assert.equal((await detailPromise).status(), 200);

  const assign = page.getByRole('button', { name: 'M’assigner', exact: true });
  if (await assign.isEnabled()) {
    const assignPromise = page.waitForResponse((response) => response.url().endsWith(`/api/support/tickets/${workflow.id}`) && response.request().method() === 'PATCH');
    await assign.click();
    assert.equal((await assignPromise).status(), 200);
  }

  const statusSelect = page.getByLabel('Statut').last();
  const statusPromise = page.waitForResponse((response) => response.url().endsWith(`/api/support/tickets/${workflow.id}`) && response.request().method() === 'PATCH');
  await statusSelect.selectOption('IN_PROGRESS');
  assert.equal((await statusPromise).status(), 200);
  const prioritySelect = page.getByLabel('Priorité').last();
  const priorityPromise = page.waitForResponse((response) => response.url().endsWith(`/api/support/tickets/${workflow.id}`) && response.request().method() === 'PATCH');
  await prioritySelect.selectOption('URGENT');
  assert.equal((await priorityPromise).status(), 200);

  const note = `Note interne navigateur ${Date.now()}`;
  await page.getByLabel('Note interne').check();
  await page.getByLabel('Réponse').fill(note);
  const notePromise = page.waitForResponse((response) => response.url().endsWith(`/api/support/tickets/${workflow.id}/replies`));
  await page.getByRole('button', { name: 'Ajouter la note', exact: true }).click();
  assert.equal((await notePromise).status(), 201);
  await page.getByText(note, { exact: true }).waitFor({ timeout: 10_000 });

  const reply = `Réponse navigateur ${Date.now()}`;
  await page.getByLabel('Note interne').uncheck();
  await page.getByLabel('Réponse').fill(reply);
  const replyPromise = page.waitForResponse((response) => response.url().endsWith(`/api/support/tickets/${workflow.id}/replies`));
  await page.getByRole('button', { name: 'Envoyer la réponse', exact: true }).click();
  assert.equal((await replyPromise).status(), 201);
  await page.getByText(reply, { exact: true }).waitFor({ timeout: 10_000 });
  const dimensions = await assertResponsive(page);
  await context.close();
  return { searched: true, opened: true, assigned: true, status: 'IN_PROGRESS', priority: 'URGENT', internalNote: true, publicReply: true, dimensions };
}

async function managerReadOnlyBrowser(browser) {
  const { context, page } = await openStaffPage(browser, 'manager', '/admin/login', '/admin/dashboard', 'Se connecter');
  await page.getByText('Dashboard Analytics', { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Vendeurs', exact: true }).click();
  await page.getByRole('heading', { name: 'Gestion des Vendeurs (Marketplace)', exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(await page.getByRole('button', { name: /Approuver|Refuser|Suspendre|Réactiver/ }).count(), 0);
  await page.getByRole('button', { name: 'Versements', exact: true }).click();
  await page.locator('h1').filter({ hasText: 'Versements vendeurs' }).waitFor({ timeout: 10_000 });
  await page.getByText(/rôle manager autorise la consultation des versements/i).waitFor({ timeout: 10_000 });
  assert.equal(await page.getByRole('button', { name: /Prendre en charge|Confirmer le versement|Refuser/ }).count(), 0);
  await context.close();
  return { sellersVisible: true, payoutsVisible: true, mutationButtons: 0 };
}

async function adminAlertPersistence(browser) {
  const { context, page } = await openStaffPage(browser, 'admin', '/admin/login', '/admin/dashboard', 'Se connecter');
  await page.getByText('Dashboard Analytics', { exact: true }).waitFor({ timeout: 15_000 });
  const buttons = page.getByRole('button', { name: /Marquer l’alerte .* comme lue/ });
  await buttons.first().waitFor({ timeout: 10_000 });
  const ariaLabel = await buttons.first().getAttribute('aria-label');
  assert.ok(ariaLabel);
  const before = await page.getByRole('button', { name: ariaLabel, exact: true }).count();
  await buttons.first().click();
  const afterClick = await page.getByRole('button', { name: ariaLabel, exact: true }).count();
  assert.ok(afterClick < before, `l’alerte n’a pas été marquée lue (${before} → ${afterClick})`);
  await page.waitForFunction(() => Object.entries(localStorage).some(([key, value]) => {
    if (!key.startsWith('mandemarket_admin_alerts_')) return false;
    try { return JSON.parse(value).read?.length > 0; } catch { return false; }
  }));
  const stored = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('mandemarket_admin_alerts_'))?.[1] || null);
  assert.ok(stored && JSON.parse(stored).read?.length > 0, 'état lu absent du stockage persistant');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Dashboard Analytics', { exact: true }).waitFor({ timeout: 15_000 });
  const afterReload = await page.getByRole('button', { name: ariaLabel, exact: true }).count();
  assert.ok(afterReload < before, `l’état lu a été perdu au rechargement (${before} → ${afterReload})`);
  await context.close();
  return { persistedAfterReload: true, matchingAlertsBefore: before, matchingAlertsAfterClick: afterClick, matchingAlertsAfterReload: afterReload, alert: ariaLabel };
}

async function sellerNotificationActions(browser, workflow, sellerToken) {
  const { context, page } = await openStaffPage(browser, 'seller', '/admin/login', '/vendeur/dashboard', 'Se connecter');
  const notificationLink = page.getByRole('link', { name: /notifications/i }).first();
  assert.equal(await notificationLink.getAttribute('href'), '/vendeur/dashboard/notifications');
  await page.goto(`${BASE}/vendeur/dashboard/notifications`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Centre de notifications', { exact: true }).waitFor({ timeout: 15_000 });
  const item = page.locator('li').filter({ hasText: workflow.reference }).first();
  await item.waitFor({ timeout: 10_000 });
  const mark = item.getByRole('button', { name: 'Marquer comme lue', exact: true });
  if (await mark.count()) {
    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/sellers/me/notifications/') && response.request().method() === 'PATCH');
    await mark.click();
    assert.equal((await responsePromise).status(), 200);
  }
  const all = page.getByRole('button', { name: /Tout marquer comme lu/ });
  if (await all.count()) {
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/sellers/me/notifications/read-all'));
    await all.click();
    assert.equal((await responsePromise).status(), 200);
  }
  const apiState = await apiRequest('/api/sellers/me/notifications', { token: sellerToken });
  assert.equal(apiState.status, 200);
  assert.equal(apiState.data?.unreadCount, 0);
  await context.close();
  return { bellTarget: '/vendeur/dashboard/notifications', referenceMarkedRead: true, unreadCount: 0 };
}

async function mailpitTotal() {
  const response = await fetch(`${MAILPIT}/api/v1/messages?limit=1`);
  assert.equal(response.status, 200, `Mailpit a répondu ${response.status}`);
  const data = await response.json();
  return Number(data.total ?? data.messages?.length ?? 0);
}

async function waitForMailpitIncrease(before, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const total = await mailpitTotal();
    if (total > before) return total;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`aucun nouvel email Mailpit après ${timeoutMs}ms (total initial ${before})`);
}

async function supportWorkflow(tokens) {
  const mailBefore = await mailpitTotal();
  const marker = new Date().toISOString().replace(/[:.]/g, '-');
  const subject = `QA espaces profils ${marker}`;
  const created = await apiRequest('/api/sellers/me/support/tickets', {
    method: 'POST',
    token: tokens.seller.token,
    body: {
      category: 'Assistance Technique',
      subject,
      message: `Ticket non destructif créé par la recette locale ${marker}.`,
    },
  });
  assert.equal(created.status, 201, `création ticket: ${created.status}`);
  assert.ok(created.data?.id && created.data?.reference, 'ticket créé sans id/référence');

  const listed = await apiRequest(`/api/support/tickets?search=${encodeURIComponent(created.data.reference)}`, {
    token: tokens.support.token,
  });
  assert.equal(listed.status, 200);
  assert.ok(listed.data?.tickets?.some((ticket) => ticket.id === created.data.id), 'ticket absent de la file support');

  const updated = await apiRequest(`/api/support/tickets/${created.data.id}`, {
    method: 'PATCH', token: tokens.support.token, body: { status: 'IN_PROGRESS', priority: 'HIGH' },
  });
  assert.equal(updated.status, 200, `mise à jour ticket: ${updated.status}`);

  const internalText = `Note interne QA ${marker}`;
  const internal = await apiRequest(`/api/support/tickets/${created.data.id}/replies`, {
    method: 'POST', token: tokens.support.token, body: { message: internalText, internal: true },
  });
  assert.equal(internal.status, 201, `note interne: ${internal.status}`);

  const publicText = `Réponse publique QA ${marker}`;
  const reply = await apiRequest(`/api/support/tickets/${created.data.id}/replies`, {
    method: 'POST', token: tokens.support.token, body: { message: publicText, internal: false },
  });
  assert.equal(reply.status, 201, `réponse publique: ${reply.status}`);

  const sellerTickets = await apiRequest('/api/sellers/me/support/tickets', { token: tokens.seller.token });
  assert.equal(sellerTickets.status, 200);
  const sellerTicket = sellerTickets.data?.find((ticket) => ticket.id === created.data.id);
  assert.ok(sellerTicket, 'ticket absent de l’espace vendeur');
  const visibleText = JSON.stringify(sellerTicket.responses || []);
  assert.ok(visibleText.includes(publicText), 'réponse publique absente de l’espace vendeur');
  assert.ok(!visibleText.includes(internalText), 'note interne exposée au vendeur');

  const mailAfter = await waitForMailpitIncrease(mailBefore);
  return {
    id: created.data.id,
    reference: created.data.reference,
    notificationQueued: created.data.notificationQueued,
    internalNoteHidden: true,
    publicReplyVisible: true,
    mailpitMessagesBefore: mailBefore,
    mailpitMessagesAfter: mailAfter,
  };
}

async function main() {
  const tokens = {};
  await check('connexions API des cinq identités', async () => {
    tokens.client = await login('/api/account/login', ...credentials.client);
    for (const role of ['admin', 'manager', 'support', 'seller']) {
      tokens[role] = await login('/api/auth/login', ...credentials[role]);
      assert.equal(tokens[role].user?.role, role);
    }
    return { roles: ['client', 'admin', 'manager', 'support', 'seller'] };
  });

  await check('matrice RBAC lecture', async () => {
    await expectStatus(tokens, 'admin', '/api/dashboard/overview', 200);
    await expectStatus(tokens, 'manager', '/api/dashboard/overview', 200);
    await expectStatus(tokens, 'support', '/api/dashboard/overview', 403);
    await expectStatus(tokens, 'seller', '/api/dashboard/overview', 403);
    await expectStatus(tokens, 'admin', '/api/support/stats', 200);
    await expectStatus(tokens, 'support', '/api/support/stats', 200);
    await expectStatus(tokens, 'manager', '/api/support/stats', 403);
    await expectStatus(tokens, 'seller', '/api/support/stats', 403);
    await expectStatus(tokens, 'admin', '/api/sellers/admin/all', 200);
    await expectStatus(tokens, 'manager', '/api/sellers/admin/all', 200);
    await expectStatus(tokens, 'admin', '/api/sellers/admin/payouts', 200);
    await expectStatus(tokens, 'manager', '/api/sellers/admin/payouts', 200);
    await expectStatus(tokens, 'seller', '/api/sellers/me/profile', 200);
    await expectStatus(tokens, 'client', '/api/account/me', 200);
    return { admin: 'complet', manager: 'lecture opérationnelle', support: 'tickets uniquement', seller: 'boutique isolée', client: 'compte isolé' };
  });

  await check('manager bloqué sur les mutations sensibles', async () => {
    await expectStatus(tokens, 'manager', '/api/sellers/admin/payouts/qa-nonexistent/process', 403, 'POST', { status: 'completed' });
    await expectStatus(tokens, 'manager', '/api/sellers/admin/payouts/qa-nonexistent/fail', 403, 'POST', { reason: 'QA' });
    await expectStatus(tokens, 'manager', '/api/sellers/admin/qa-nonexistent/approve', 403, 'PUT', { status: 'approved' });
    return { denied: 3, dataChanged: false };
  });

  let supportResult = null;
  if (MUTATE_SUPPORT) {
    await check('workflow vendeur → support → outbox Mailpit', async () => {
      supportResult = await supportWorkflow(tokens);
      return supportResult;
    });
  }

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  await check('espace client navigateur', () => browserClientLogin(browser));
  await check('espace admin navigateur', () => browserStaffLogin(browser, 'admin', '/admin/login', '/admin/dashboard', 'Dashboard Analytics', 'Se connecter'));
  await check('espace manager navigateur', () => browserStaffLogin(browser, 'manager', '/admin/login', '/admin/dashboard', 'Dashboard Analytics', 'Se connecter'));
  await check('espace support navigateur', () => browserStaffLogin(browser, 'support', '/support/login', '/support/dashboard', 'Support MandeMarket', 'Accéder aux tickets'));
  await check('espace vendeur navigateur', () => browserStaffLogin(browser, 'seller', '/admin/login', '/vendeur/dashboard', 'Vue d’ensemble', 'Se connecter'));
  await check('manager lecture seule dans l’interface', () => managerReadOnlyBrowser(browser));
  await check('persistance des alertes admin', () => adminAlertPersistence(browser));
  if (supportResult) {
    await check('actions du portail support', () => supportBrowserActions(browser, supportResult));
    await check('notifications vendeur', () => sellerNotificationActions(browser, supportResult, tokens.seller.token));
  }
  await browser.close();

  await check('navigateur sans erreur inattendue', async () => {
    assert.deepEqual(report.browserErrors, []);
    return { errors: 0 };
  });

  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.every((item) => item.pass);
  const output = path.join(ROOT, 'qa-results', 'profile-spaces-qa.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`REPORT ${output}\n`);
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
