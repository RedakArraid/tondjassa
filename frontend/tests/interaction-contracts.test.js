const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const appRoot = path.join(root, 'app');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}

const sourceFiles = walk(appRoot).filter((file) => file.endsWith('.tsx'));

test('aucun bouton ou lien factice connu ne reste dans les composants', () => {
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /href\s*=\s*["'`]#["'`]/, `${file} contient un lien # factice`);
    assert.doesNotMatch(source, /onClick\s*=\s*\{\s*\(.*?\)\s*=>\s*\{\s*\}\s*\}/s, `${file} contient un gestionnaire vide`);

    const links = source.match(/<Link\b[\s\S]*?<\/Link>/g) || [];
    for (const link of links) {
      assert.doesNotMatch(link, /<button\b/, `${file} imbrique un bouton dans un lien`);
    }
  }
});

test('toutes les destinations internes écrites dans le frontend correspondent à une page', () => {
  const routes = walk(appRoot)
    .filter((file) => path.basename(file) === 'page.tsx')
    .map((file) => `/${path.relative(appRoot, path.dirname(file)).split(path.sep).join('/')}`)
    .map((route) => route === '/.' ? '/' : route);

  const matchesRoute = (target) => {
    const targetParts = target.split('/').filter(Boolean);
    return routes.some((route) => {
      const routeParts = route.split('/').filter(Boolean);
      return routeParts.length === targetParts.length && targetParts.every((part, index) => (
        part === ':dynamic' || /^\[[^/]+\]$/.test(routeParts[index]) || part === routeParts[index]
      ));
    });
  };

  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const expressions = [
      /<(?:Link|a)\b[^>]*?href\s*=\s*["']([^"'#?]+)[^"']*["']/g,
      /(?:href\s*=\s*\{|router\.(?:push|replace)\()\s*`([^`]+)`/g,
    ];
    for (const expression of expressions) {
      for (const match of source.matchAll(expression)) {
        const target = match[1].replace(/\$\{[^}]+\}/g, ':dynamic').split('?')[0];
        if (target.startsWith('/') && !target.startsWith('//')) {
          assert.ok(matchesRoute(target), `${file} pointe vers la page absente ${match[1]}`);
        }
      }
    }
  }
});

test('la prévisualisation vendeur utilise la route publique existante', () => {
  const appearance = fs.readFileSync(path.join(appRoot, 'vendeur/dashboard/boutique/apparence/page.tsx'), 'utf8');

  assert.match(appearance, /`\/vendeur\/\$\{slug\}`/);
  assert.doesNotMatch(appearance, /\/boutiques(?:\/|\b)/, 'la route historique /boutiques ne doit plus être utilisée');
});

test('les contrôles iconiques et switches signalés ont un nom accessible', () => {
  const login = fs.readFileSync(path.join(appRoot, 'admin/login/page.tsx'), 'utf8');
  const notifications = fs.readFileSync(path.join(appRoot, 'vendeur/dashboard/parametres/notifications/page.tsx'), 'utf8');

  assert.match(login, /aria-label=\{showPassword \? 'Masquer le mot de passe' : 'Afficher le mot de passe'\}/);
  assert.match(notifications, /role="switch"[\s\S]*?aria-label=/);
});

test('le dashboard admin conserve une largeur fluide sur petit écran', () => {
  const dashboard = fs.readFileSync(path.join(appRoot, 'admin/dashboard/page.tsx'), 'utf8');
  const charts = fs.readFileSync(path.join(appRoot, 'admin/components/SalesCharts.tsx'), 'utf8');

  assert.match(dashboard, /flex-col bg-brand-cream lg:flex-row/);
  assert.match(dashboard, /min-w-0 w-full flex-1 overflow-x-hidden/);
  assert.match(charts, /flex-col gap-4 mb-6 sm:flex-row/);
});

test('les séries mensuelles admin acceptent date ou month sans faire crasher le graphique', () => {
  const charts = fs.readFileSync(path.join(appRoot, 'admin/components/SalesCharts.tsx'), 'utf8');

  assert.match(charts, /normalizeSalesSeries\(sourceData\.monthlyRevenue\)/);
  assert.match(charts, /data=\{activeSeries\}/);
  assert.match(charts, /dataKey="date"/);
  assert.match(charts, /labelFormatter=\{formatChartDate\}/);
  assert.match(charts, /activeSeries\.map\(\(row\) => \[row\.date, row\.revenue, row\.orders\]\)/);
});

test('la période des statistiques vendeur filtre réellement les commandes', () => {
  const statistics = fs.readFileSync(path.join(appRoot, 'vendeur/dashboard/statistiques/page.tsx'), 'utf8');
  const sellerUi = fs.readFileSync(path.join(appRoot, 'vendeur/dashboard/_components/ui.tsx'), 'utf8');

  assert.match(statistics, /const periodOrders = periodStart/);
  assert.match(statistics, /createdAt >= periodStart/);
  assert.match(statistics, /order\.sellerTotal \?\? order\.totalAmount/);
  assert.doesNotMatch(sellerUi, /Personnaliser/);
});

test('les parcours interactifs corrigés restent reliés à leurs actions réelles', () => {
  const home = fs.readFileSync(path.join(appRoot, 'page.tsx'), 'utf8');
  const blog = fs.readFileSync(path.join(appRoot, 'blog/page.tsx'), 'utf8');
  const shop = fs.readFileSync(path.join(appRoot, 'boutique/page.tsx'), 'utf8');
  const cart = fs.readFileSync(path.join(appRoot, 'panier/page.tsx'), 'utf8');
  const tracking = fs.readFileSync(path.join(appRoot, 'suivi/page.tsx'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');

  assert.match(home, /ContactService\.subscribeNewsletter\(email\)/);
  assert.match(blog, /ContactService\.subscribeNewsletter\(value\)/);
  assert.match(shop, /addItem\(product, 1\)/);
  assert.match(shop, /searchParams\?\.get\('category'\)/);
  assert.match(cart, /sessionStorage\.setItem\('mm_pending_promo'/);
  assert.match(tracking, /\/api\/shipping\/track\//);
  assert.match(config, /connectSources\.push\('https:\/\/ipapi\.co'\)/);
});
