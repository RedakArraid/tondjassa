const fs = require('fs');
const path = require('path');
const db = require('../db');
const verification = require('../services/verification.service');
const ledgerService = require('../services/ledger.service');

function routeHandler(router, routePath, method) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${routePath} introuvable`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

describe('Contrats des actions frontend', () => {
  afterEach(() => jest.restoreAllMocks());

  test('l inscription vendeur accepte le nom personnel vide et reprend le nom de boutique', async () => {
    const router = require('../routes.auth');
    const handler = routeHandler(router, '/signup-seller', 'post');
    jest.spyOn(db.user, 'findUnique').mockResolvedValue(null);
    jest.spyOn(db.seller, 'findUnique').mockResolvedValue(null);
    const userCreate = jest.fn().mockResolvedValue({ id: 'user-1', email: 'seller@example.com' });
    const sellerCreate = jest.fn().mockResolvedValue({ id: 'seller-1' });
    jest.spyOn(db, '$transaction').mockImplementation(async (callback) => callback({
      user: { create: userCreate },
      seller: { create: sellerCreate },
    }));
    jest.spyOn(verification, 'sendVerification').mockResolvedValue(undefined);

    const res = responseRecorder();
    await handler({ body: {
      email: 'seller@example.com', password: 'Seller-password-123', name: '',
      storeName: 'Boutique Test', description: '',
    } }, res);

    expect(res.statusCode).toBe(202);
    expect(userCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Boutique Test', role: 'seller' }),
    }));
  });

  test('la creation rapide d un produit materialise une description vide valide', async () => {
    const router = require('../routes.product');
    const handler = routeHandler(router, '/', 'post');
    jest.spyOn(db.category, 'findUnique').mockResolvedValue({ id: 'category-1', status: 'active' });
    const productCreate = jest.fn().mockResolvedValue({ id: 123, name: 'Produit test' });
    const inventoryCreate = jest.fn().mockResolvedValue({ productId: 123 });
    jest.spyOn(db, '$transaction').mockImplementation(async (callback) => callback({
      product: { create: productCreate },
      inventory: { create: inventoryCreate },
    }));

    const res = responseRecorder();
    await handler({
      body: { name: 'Produit test', price: 10000, categoryId: 'category-1', stock: 2, status: 'draft' },
      seller: { id: 'seller-1' },
    }, res);

    expect(res.statusCode).toBe(201);
    expect(productCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ description: '', sellerId: 'seller-1' }),
    }));
  });

  test.each([
    ['/me/products/:id/duplicate', 'post'],
    ['/me/products/:id/status', 'put'],
    ['/me/products/:id/stock', 'put'],
    ['/me/products/:id/stats', 'get'],
  ])('%s rejette un identifiant non numerique sans interroger Prisma', async (routePath, method) => {
    const router = require('../routes.sellers');
    const handler = routeHandler(router, routePath, method);
    const lookup = jest.spyOn(db.product, 'findUnique');
    const res = responseRecorder();
    await handler({ params: { id: 'null' }, body: {}, seller: { id: 'seller-1' } }, res);
    expect(res.statusCode).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  test('les reglages vendeur partiels preservent les coordonnees de paiement existantes', async () => {
    const router = require('../routes.sellers');
    const handler = routeHandler(router, '/me/settings', 'put');
    const update = jest.spyOn(db.seller, 'update').mockResolvedValue({ id: 'seller-1' });
    const res = responseRecorder();
    await handler({
      body: { paymentInfo: { shippingZones: [{ id: 'zone-1' }] } },
      seller: { id: 'seller-1', paymentInfo: { accountNumber: '010203', banner: 'https://example.com/banner.jpg' } },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      paymentInfo: expect.objectContaining({
        accountNumber: '010203', banner: 'https://example.com/banner.jpg', shippingZones: [{ id: 'zone-1' }],
      }),
    }) }));
  });

  test('le profil boutique persiste les champs publics sans effacer les donnees financieres', async () => {
    const router = require('../routes.sellers');
    const handler = routeHandler(router, '/me/profile', 'put');
    const update = jest.spyOn(db.seller, 'update').mockResolvedValue({ id: 'seller-1' });
    const res = responseRecorder();
    await handler({
      body: { phone: '+22501020304', email: 'boutique@example.com', hours: '9h-18h' },
      seller: { id: 'seller-1', paymentInfo: { method: 'mobile_money', accountNumber: '010203' } },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      paymentInfo: expect.objectContaining({
        method: 'mobile_money', accountNumber: '010203', phone: '+22501020304',
        email: 'boutique@example.com', hours: '9h-18h',
      }),
    }) }));
  });

  test('le solde vendeur respecte la forme attendue par les pages de retrait', async () => {
    const router = require('../routes.sellers');
    const handler = routeHandler(router, '/me/balance', 'get');
    const balances = { available: 100000, pending: 20000, reserved: 0, paid: 50000 };
    jest.spyOn(ledgerService, 'getSellerBalances').mockResolvedValue(balances);
    const res = responseRecorder();
    await handler({ seller: { id: 'seller-1' } }, res);
    expect(res.payload).toEqual({ balances });
  });

  test('la vitrine publique ne selectionne jamais paymentInfo', async () => {
    const router = require('../routes.sellers');
    const handler = routeHandler(router, '/slug/:slug', 'get');
    const find = jest.spyOn(db.seller, 'findFirst').mockResolvedValue({
      id: 'seller-1', storeName: 'Boutique', slug: 'boutique', products: [], _count: { products: 0 },
    });
    const res = responseRecorder();
    await handler({ params: { slug: 'boutique' } }, res);
    const query = find.mock.calls[0][0];
    expect(query.select.paymentInfo).toBeUndefined();
    expect(query.include).toBeUndefined();
    expect(res.payload).not.toHaveProperty('paymentInfo');
  });

  test('le seed rend les comptes documentes verifies et relie les deux profils clients', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../scripts/seed.js'), 'utf8');
    expect((source.match(/emailVerifiedAt: seedVerifiedAt/g) || [])).toHaveLength(12);
    expect(source).toContain("role: 'support'");
    expect(source).toContain("support@mandemarket.com");
    expect(source).toContain('userId: clientCiUser.id');
    expect(source).toContain('userId: clientFrUser.id');
  });
});
