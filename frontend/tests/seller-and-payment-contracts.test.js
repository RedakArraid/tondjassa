const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FRONTEND = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(FRONTEND, relativePath), 'utf8');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

test('le checkout affiche uniquement les providers retournés par le serveur', () => {
  const checkout = read('app/checkout/page.tsx');
  assert.match(checkout, /\/api\/payment\/providers\?country=/);
  assert.match(checkout, /paymentProviders\.map\(provider/);
  assert.match(checkout, /provider\.methods\.map\(formatPaymentMethod\)\.join/);
  assert.doesNotMatch(checkout, /value=["']cash_on_delivery["']/i);
  assert.doesNotMatch(checkout, /const\s+(?:AFRICA|EUROPE)_PAYMENT/);
});

test('les fournisseurs retirés ne figurent plus dans le code frontend', () => {
  const roots = [path.join(FRONTEND, 'app'), path.join(FRONTEND, 'types')];
  const retiredProviders = [new RegExp(['cine', 'tpay'].join(''), 'i'), new RegExp(['mo', 'ov'].join(''), 'i')];
  const violations = roots.flatMap(walk).filter(file => retiredProviders.some(pattern => pattern.test(fs.readFileSync(file, 'utf8'))));
  assert.deepEqual(violations, []);
});

test('les préférences vendeur utilisent le contrat GET/PUT complet', () => {
  const api = read('app/config/api.ts');
  const page = read('app/vendeur/dashboard/parametres/notifications/page.tsx');
  assert.match(api, /getMyNotificationPreferences/);
  assert.match(api, /put\('\/api\/sellers\/me\/notification-preferences', preferences\)/);
  for (const key of ['newOrder', 'newMessage', 'newReview', 'newFollower', 'lowStock', 'payments', 'marketing', 'platformMessages']) {
    assert.match(page, new RegExp(`${key}:`));
  }
  assert.doesNotMatch(page, /window\.alert|\balert\(/);
});

test('la page équipe charge les permissions et envoie les invitations prévues', () => {
  const api = read('app/config/api.ts');
  const page = read('app/vendeur/dashboard/boutique/equipe/page.tsx');
  assert.match(api, /get\('\/api\/sellers\/me\/team'\)/);
  assert.match(api, /post\('\/api\/sellers\/me\/team\/invite', \{ email, role \}\)/);
  assert.match(page, /member\.permissions\.map/);
  for (const role of ['manager', 'catalog', 'orders', 'finance']) {
    assert.match(page, new RegExp(`value: '${role}'`));
  }
  assert.doesNotMatch(page, /window\.alert|\balert\(/);
});

test('les anciens placeholders et logs demandés ont été supprimés', () => {
  const appSources = walk(path.join(FRONTEND, 'app')).map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(appSources, /notifySoon/);
  assert.doesNotMatch(appSources, /Calcul totalItems/);
});
