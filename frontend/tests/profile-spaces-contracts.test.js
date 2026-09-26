const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('le portail support couvre authentification, file et traitement des tickets', () => {
  const login = read('app/support/login/page.tsx');
  const dashboard = read('app/support/dashboard/page.tsx');
  const api = read('app/config/api.ts');

  assert.match(login, /\['support', 'admin'\]\.includes/);
  assert.match(dashboard, /SupportService\.getStats\(\)/);
  assert.match(dashboard, /SupportService\.getTickets/);
  assert.match(dashboard, /SupportService\.getTicket/);
  assert.match(dashboard, /SupportService\.updateTicket/);
  assert.match(dashboard, /SupportService\.addMessage/);
  assert.match(dashboard, /assignedToId: currentUser\.id/);
  assert.match(api, /\/api\/support\/tickets\/\$\{id\}\/replies/);
  assert.match(api, /apiService\.patch\(`\/api\/support\/tickets\/\$\{id\}`/);
  assert.doesNotMatch(api, /\/api\/support\/tickets\/\$\{id\}\/messages/);
});

test('les notifications vendeur utilisent le contrat canonique et un vrai centre', () => {
  const api = read('app/config/api.ts');
  const shell = read('app/vendeur/dashboard/_components/SellerShell.tsx');
  const page = read('app/vendeur/dashboard/notifications/page.tsx');

  assert.match(api, /apiService\.patch\(`\/api\/sellers\/me\/notifications\/\$\{id\}\/read`\)/);
  assert.match(api, /apiService\.patch\('\/api\/sellers\/me\/notifications\/read-all'\)/);
  assert.match(shell, /href="\/vendeur\/dashboard\/notifications"/);
  assert.match(page, /payload\?\.notifications \|\| \[\]/);
  assert.match(page, /payload\?\.unreadCount/);
  assert.match(page, /markNotificationRead/);
  assert.match(page, /markAllNotificationsRead/);
});

test('les alertes admin persistent par utilisateur', () => {
  const alerts = read('app/admin/components/AlertsManager.tsx');
  assert.match(alerts, /mandemarket_admin_alerts_\$\{identity\}/);
  assert.match(alerts, /localStorage\.getItem/);
  assert.match(alerts, /localStorage\.setItem/);
  assert.match(alerts, /dismissed: dismissedAlertIds/);
});

test('le manager reste en lecture seule sur vendeurs, versements et remboursements', () => {
  const dashboard = read('app/admin/dashboard/page.tsx');
  const sellers = read('app/admin/components/SellersManager.tsx');
  const payouts = read('app/admin/components/PayoutsManager.tsx');
  const returns = read('app/admin/components/ReturnsModerationManager.tsx');

  assert.match(dashboard, /<SellersManager readOnly=\{user\.role !== 'admin'\}/);
  assert.match(dashboard, /<PayoutsManager readOnly=\{user\.role !== 'admin'\}/);
  assert.match(dashboard, /<ReturnsModerationManager canRefund=\{user\.role === 'admin'\}/);
  assert.match(sellers, /!readOnly && s\.status/);
  assert.match(payouts, /!readOnly && \['pending', 'processing'\]/);
  assert.match(returns, /canRefund && ret\.status === 'approved'/);
});

test('les collaborateurs vendeur ne voient pas les mutations sans permission', () => {
  const shell = read('app/vendeur/dashboard/_components/SellerShell.tsx');
  const products = read('app/vendeur/dashboard/produits/page.tsx');
  const orders = read('app/vendeur/dashboard/commandes/_components/SellerOrdersView.tsx');
  const access = read('app/vendeur/dashboard/_components/access.tsx');

  assert.match(shell, /can\('catalog\.write'\)/);
  assert.match(shell, /childPermission/);
  assert.match(products, /const canWrite = can\('catalog\.write'\)/);
  assert.match(orders, /const canWrite = can\('orders\.write'\)/);
  assert.match(orders, /canWrite && \(orderStatus === 'PENDING'/);
  assert.match(access, /permissions\.includes\('\*'\)/);
});

test('les statistiques vendeur ne fabriquent plus d’activité', () => {
  const overview = read('app/vendeur/dashboard/page.tsx');
  const visitors = read('app/vendeur/dashboard/statistiques/visiteurs/page.tsx');
  const buyers = read('app/vendeur/dashboard/statistiques/abonnes/page.tsx');

  assert.doesNotMatch(overview, /Nouveau message|Paiement disponible|Produits les plus vendus/);
  assert.match(overview, /Aperçu du catalogue/);
  assert.doesNotMatch(visitors, /: '5\.0'/);
  assert.doesNotMatch(buyers, /customers\.length > 0 \? '100 %'/);
});
