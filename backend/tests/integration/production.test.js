const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
if (process.env.NODE_ENV !== 'test' || !process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')) {
  throw new Error('Integration tests require NODE_ENV=test and a dedicated TEST_DATABASE_URL ending in _test');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = 'integration-only-secret-not-for-production-12345';
const db = require('../../src/db');
const { OrderService: Orders } = require('../../src/services/order.service');
const Payments = require('../../src/services/payment.service');
const Ledger = require('../../src/services/ledger.service');
const Refunds = require('../../src/services/refund.service');
const Verification = require('../../src/services/verification.service');
const Sessions = require('../../src/services/session.service');
const Email = require('../../src/services/email.service');
const app = require('../../src/app');
let server, base;
const req = { ip: '127.0.0.1', headers: {} };
beforeAll(async () => {
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { await new Promise((resolve) => server.close(resolve)); await db.$disconnect(); });
beforeEach(async () => {
  jest.restoreAllMocks();
  await db.$executeRawUnsafe('TRUNCATE TABLE "User", "Customer", "Category", "Promotion", "AuditLog", "PaymentEvent", "EmailOutbox" RESTART IDENTITY CASCADE');
});
async function fixture(stock = 10) {
  const buyer = await db.user.create({ data: { email: 'buyer@test.invalid', password: await bcrypt.hash('Buyer-password-123', 4), role: 'customer', emailVerifiedAt: new Date(),
    customer: { create: { email: 'buyer@test.invalid', firstName: 'Buyer', lastName: 'Test' } } }, include: { customer: true } });
  const sellerUser = await db.user.create({ data: { email: 'seller@test.invalid', password: 'hash', role: 'seller', emailVerifiedAt: new Date(),
    seller: { create: { storeName: 'Store', slug: 'store', status: 'approved' } } }, include: { seller: true } });
  const category = await db.category.create({ data: { name: 'Test', slug: 'test', description: 'Test' } });
  const product = await db.product.create({ data: { name: 'Product', price: 2000000, description: 'Test', categoryId: category.id,
    sellerId: sellerUser.seller.id, images: [], styles: [], features: [], colors: [], stock,
    inventory: { create: { quantity: stock, available: stock, reserved: 0 } } } });
  return { buyer, seller: sellerUser.seller, sellerUser, product };
}
const data = (f, extra = {}) => ({ customerData: { firstName: 'Buyer', lastName: 'Test', email: f.buyer.email },
  addressData: { street: 'Test', city: 'Abidjan', postalCode: '00000', country: 'CI' },
  items: [{ productId: f.product.id, quantity: 1 }], shippingMethod: 'PICKUP', paymentMethod: 'paystack',
  idempotencyKey: crypto.randomUUID(), reqUser: { userId: f.buyer.id }, ...extra });
async function pay(order) {
  const reference = `ref-${order.id}`;
  await db.payment.update({ where: { orderId: order.id }, data: { gateway: 'paystack', transactionId: reference, status: 'PROCESSING' } });
  const input = { orderId: order.id, gateway: 'paystack', transactionId: reference, eventId: 'webhook-1', amountPaid: order.totalAmount, currency: 'XOF' };
  await Payments.processPaymentSuccess(input); return input;
}
async function deliver(order) {
  for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) await Orders.transitionOrderStatus(order.id, status);
}
test('two concurrent checkouts cannot oversell the last unit', async () => {
  const f = await fixture(1);
  const result = await Promise.allSettled([Orders.checkoutOrder(data(f)), Orders.checkoutOrder(data(f))]);
  expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const inv = await db.inventory.findUnique({ where: { productId: f.product.id } });
  expect(inv).toMatchObject({ quantity: 1, reserved: 1, available: 0 });
  expect(await db.order.count()).toBe(1);
});
test('duplicate checkout returns the same order even after stock is exhausted', async () => {
  const f = await fixture(1), input = data(f);
  const first = await Orders.checkoutOrder(input);
  const second = await Orders.checkoutOrder(input);
  expect(second.order.id).toBe(first.order.id); expect(second.isDuplicate).toBe(true);
  expect(await db.order.count()).toBe(1);
});
test('concurrent duplicate webhook and manual verification credit a payment once', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f));
  const input = await pay(order);
  await Promise.all([Payments.processPaymentSuccess({ ...input, eventId: 'manual-2' }), Payments.processPaymentSuccess({ ...input, eventId: 'webhook-3' })]);
  expect((await db.customer.findUnique({ where: { id: f.buyer.customer.id } })).totalSpent).toBe(order.totalAmount);
  expect((await db.seller.findUnique({ where: { id: f.seller.id } })).totalSales).toBe(order.totalAmount);
  expect(await db.sellerLedgerEntry.count()).toBe(1);
  expect(await db.paymentEvent.count({ where: { eventType: 'PAYMENT_SUCCESS' } })).toBe(1);
});
test('payment and order confirmation roll back together when the ledger fails', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f));
  jest.spyOn(Ledger, 'recordOrderPayment').mockRejectedValueOnce(new Error('simulated ledger failure'));
  await expect(pay(order)).rejects.toThrow('simulated ledger failure');
  expect((await db.order.findUnique({ where: { id: order.id } })).status).toBe('PENDING');
  expect((await db.payment.findUnique({ where: { orderId: order.id } })).status).toBe('PROCESSING');
  expect((await db.customer.findUnique({ where: { id: f.buyer.customer.id } })).totalSpent).toBe(0);
});
test('wrong payment currency or amount cannot complete an order', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f));
  await db.payment.update({ where: { orderId: order.id }, data: { status: 'PROCESSING', gateway: 'paystack', transactionId: 'ref' } });
  const input = { orderId: order.id, gateway: 'paystack', transactionId: 'ref', amountPaid: order.totalAmount, currency: 'USD', eventId: 'e' };
  await expect(Payments.processPaymentSuccess(input)).rejects.toThrow('devise');
  await expect(Payments.processPaymentSuccess({ ...input, currency: 'XOF', amountPaid: order.totalAmount / 100 })).rejects.toThrow('Montant');
  expect(await db.sellerLedgerEntry.count()).toBe(0);
});
test('late failure cannot downgrade completed payment', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f)); const input = await pay(order);
  expect((await Payments.processPaymentFailure({ ...input, eventId: 'late-failure', reason: 'old event' })).ignored).toBe(true);
  expect((await db.payment.findUnique({ where: { orderId: order.id } })).status).toBe('COMPLETED');
});
test('cancellation releases a reservation once without increasing physical stock', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f));
  await Promise.all([Orders.transitionOrderStatus(order.id, 'CANCELLED'), Orders.transitionOrderStatus(order.id, 'CANCELLED')]);
  expect(await db.inventory.findUnique({ where: { productId: f.product.id } })).toMatchObject({ quantity: 10, available: 10, reserved: 0 });
});
test('late success on a cancelled order queues a refund, not a shipment or seller credit', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f));
  await db.payment.update({ where: { orderId: order.id }, data: { status: 'PROCESSING', gateway: 'paystack', transactionId: `ref-${order.id}` } });
  await Orders.transitionOrderStatus(order.id, 'CANCELLED');
  await pay(order);
  expect((await db.order.findUnique({ where: { id: order.id } })).status).toBe('CANCELLED');
  expect(await db.refund.findUnique({ where: { orderId: order.id } })).toMatchObject({ status: 'REQUESTED' });
  expect(await db.sellerLedgerEntry.count()).toBe(0);
});
test('concurrent payout requests cannot reserve the same balance twice', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f)); await pay(order); await deliver(order);
  const results = await Promise.allSettled([Ledger.requestPayout({ sellerId: f.seller.id, amount: 1500000 }), Ledger.requestPayout({ sellerId: f.seller.id, amount: 1500000 })]);
  expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  expect((await Ledger.getSellerBalances(f.seller.id)).available).toBe(300000);
});
test('completed payout is deducted exactly once: 20000 minus 5000 equals 15000 FCFA', async () => {
  const f = await fixture();
  await db.sellerLedgerEntry.create({ data: { sellerId: f.seller.id, type: 'ADJUSTMENT', status: 'AVAILABLE', amount: 2000000, netAmount: 2000000, feeAmount: 0 } });
  const payout = await Ledger.requestPayout({ sellerId: f.seller.id, amount: 500000 });
  await Ledger.updatePayoutStatus(payout.id, 'processing'); await Ledger.processPayout(payout.id, { reference: 'bank-confirmed-123' });
  await Ledger.processPayout(payout.id, { reference: 'bank-confirmed-123' });
  expect(await Ledger.getSellerBalances(f.seller.id)).toMatchObject({ available: 1500000, paid: 500000, reserved: 0 });
});
test('refund confirmation reverses ledger and restocks exactly once', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f)); await pay(order); await deliver(order);
  const refund = await Refunds.request(order.id, { reason: 'Returned', restock: true });
  await Refunds.finalize(refund.id, 'provider-receipt-123'); await Refunds.finalize(refund.id, 'provider-receipt-123');
  expect((await Ledger.getSellerBalances(f.seller.id)).available).toBe(0);
  expect(await db.sellerLedgerEntry.count({ where: { type: 'REFUND' } })).toBe(1);
  expect(await db.inventory.findUnique({ where: { productId: f.product.id } })).toMatchObject({ quantity: 10, reserved: 0, available: 10 });
  expect((await db.payment.findUnique({ where: { orderId: order.id } })).status).toBe('REFUNDED');
});
test('registration does not attach guest history before email proof; verification replaces the untrusted password', async () => {
  const guest = await db.customer.create({ data: { email: 'guest@test.invalid', firstName: 'Guest', lastName: 'Person' } });
  const mail = jest.spyOn(Email, 'sendEmail').mockResolvedValue({ success: true });
  const result = await Verification.registerCustomer({ email: guest.email, password: 'Attacker-chosen-123', firstName: 'Guest', lastName: 'Person' });
  expect(result.verificationRequired).toBe(true); expect(result).not.toHaveProperty('token');
  expect((await db.customer.findUnique({ where: { id: guest.id } })).userId).toBeNull();
  const token = mail.mock.calls[0][0].html.match(/#token=([a-f0-9]{64})/)[1];
  await Verification.verifyEmail(token, 'Real-owner-password-123');
  const user = await db.user.findUnique({ where: { email: guest.email } });
  expect(await bcrypt.compare('Attacker-chosen-123', user.password)).toBe(false);
  expect((await db.customer.findUnique({ where: { id: guest.id } })).userId).toBe(user.id);
  await expect(Verification.verifyEmail(token, 'Another-password-123')).rejects.toThrow();
});
test('legacy tokens are rejected and revocation invalidates active access immediately', async () => {
  const f = await fixture(); const session = await Sessions.createSession(f.buyer.id, req);
  const token = Sessions.generateAccessToken(f.buyer, session.sessionId);
  expect((await Sessions.authenticateToken(token)).userId).toBe(f.buyer.id);
  await Sessions.revokeAllUserSessions(f.buyer.id);
  await expect(Sessions.authenticateToken(token)).rejects.toThrow();
  const legacy = jwt.sign({ userId: f.buyer.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  await expect(Sessions.authenticateToken(legacy)).rejects.toThrow();
});
test('public order reference refuses PII without a capability and works with valid schema fields', async () => {
  const f = await fixture(); const secret = crypto.randomBytes(32).toString('hex');
  const { order } = await Orders.checkoutOrder(data(f, { reqUser: null, checkoutSecret: secret }));
  const denied = await fetch(`${base}/api/orders/reference/${order.orderNumber}`); expect(denied.status).toBe(404);
  const allowed = await fetch(`${base}/api/orders/reference/${order.orderNumber}`, { headers: { 'X-Order-Token': secret } });
  expect(allowed.status).toBe(200); const body = await allowed.json();
  expect(body.order).not.toHaveProperty('checkoutSecretHash'); expect(body.order).not.toHaveProperty('idempotencyKey');
  expect(body.order.customer.email).toBe(f.buyer.email);
  const status = await fetch(`${base}/api/payment/status/${order.id}`); expect(status.status).toBe(404);
});

test('CI checkout exposes cash on delivery and Paystack only when configured', async () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;
  const offline = await fetch(`${base}/api/payment/providers?country=CI`);
  expect(offline.status).toBe(200);
  expect((await offline.json()).providers.map((provider) => provider.gateway)).toEqual(['cash_on_delivery']);
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_integration_paystack_key_12345';
  const online = await fetch(`${base}/api/payment/providers?country=CI`);
  const onlineBody = await online.json();
  expect(onlineBody.providers.map((provider) => provider.gateway)).toEqual(['cash_on_delivery', 'paystack']);
  expect(onlineBody.enabledCountries).toEqual(['CI', 'FR']);
  const unsupported = await fetch(`${base}/api/payment/providers?country=SN`);
  expect(unsupported.status).toBe(422);
  expect((await unsupported.json()).providers).toEqual([]);
  if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = previous;
});

test('a forged checkout cannot reserve stock through an unavailable payment provider', async () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;
  try {
    const f = await fixture(1);
    const response = await fetch(`${base}/api/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { firstName: 'Guest', lastName: 'Buyer', email: 'guest@test.invalid' },
        address: { street: 'Test', city: 'Abidjan', postalCode: '00000', country: 'CI' },
        items: [{ productId: f.product.id, quantity: 1 }],
        paymentMethod: 'paystack', shippingMethod: 'PICKUP',
        idempotencyKey: crypto.randomUUID(), checkoutSecret: crypto.randomBytes(32).toString('hex'),
      }),
    });
    expect(response.status).toBe(422);
    expect(await db.order.count()).toBe(0);
    expect(await db.inventory.findUnique({ where: { productId: f.product.id } })).toMatchObject({ reserved: 0, available: 1 });
  } finally {
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  }
});

test('a signed Paystack refund reverses a completed payment exactly once', async () => {
  const f = await fixture(); const { order } = await Orders.checkoutOrder(data(f)); const input = await pay(order);
  const previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_integration_paystack_key_12345';
  const Paystack = require('../../src/services/paystack.service');
  jest.spyOn(Paystack, 'verifyTransaction').mockResolvedValue({ status: true, data: {
    status: 'success', amount: order.totalAmount, currency: 'XOF', metadata: { orderId: order.id },
  } });
  const event = { event: 'refund.processed', data: { id: 987, transaction_reference: input.transactionId,
    refund_reference: 'refund-provider-987', amount: String(order.totalAmount), currency: 'XOF' } };
  const raw = JSON.stringify(event);
  const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
  const first = await fetch(`${base}/api/payment/webhook/paystack`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature }, body: raw });
  expect(first.status).toBe(200);
  const second = await fetch(`${base}/api/payment/webhook/paystack`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature }, body: raw });
  expect(second.status).toBe(200);
  expect(await db.payment.findUnique({ where: { orderId: order.id } })).toMatchObject({ status: 'REFUNDED' });
  expect(await db.order.findUnique({ where: { id: order.id } })).toMatchObject({ status: 'REFUNDED' });
  expect(await db.sellerLedgerEntry.count({ where: { orderId: order.id, type: 'SALE_PENDING', status: 'CANCELLED' } })).toBe(1);
  expect(await db.paymentEvent.count({ where: { orderId: order.id, eventType: 'PROVIDER_REFUND' } })).toBe(1);
  if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = previous;
});

test('seller invitations create a durable email and grant only the selected permissions', async () => {
  const f = await fixture();
  const collaborator = await db.user.create({ data: { email: 'catalog@test.invalid', password: await bcrypt.hash('Catalog-password-123', 4),
    name: 'Catalog User', role: 'customer', emailVerifiedAt: new Date(),
    customer: { create: { email: 'catalog@test.invalid', firstName: 'Catalog', lastName: 'User' } } } });
  const ownerSession = await Sessions.createSession(f.sellerUser.id, req);
  const ownerToken = Sessions.generateAccessToken(f.sellerUser, ownerSession.sessionId);
  const invited = await fetch(`${base}/api/sellers/me/team/invite`, { method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: collaborator.email, role: 'catalog' }) });
  expect(invited.status).toBe(201);
  const outbox = await db.emailOutbox.findFirst({ where: { recipient: collaborator.email } });
  expect(outbox).toMatchObject({ status: 'PENDING', template: 'rendered-html' });
  const invitationToken = outbox.payload.html.match(/#token=([a-f0-9]{64})/)[1];
  const collaboratorSession = await Sessions.createSession(collaborator.id, req);
  const collaboratorToken = Sessions.generateAccessToken(collaborator, collaboratorSession.sessionId);
  const accepted = await fetch(`${base}/api/sellers/invitations/${invitationToken}/accept`, { method: 'POST',
    headers: { Authorization: `Bearer ${collaboratorToken}` } });
  expect(accepted.status).toBe(200);
  const acceptedBody = await accepted.json();
  expect(acceptedBody).toMatchObject({ success: true, role: 'catalog' });
  expect(acceptedBody.accessToken).toBeTruthy();
  const profile = await fetch(`${base}/api/sellers/me/profile`, { headers: { Authorization: `Bearer ${acceptedBody.accessToken}` } });
  expect(profile.status).toBe(200);
  expect((await profile.json()).access).toMatchObject({ isOwner: false, role: 'catalog' });
  const deniedTeam = await fetch(`${base}/api/sellers/me/team`, { headers: { Authorization: `Bearer ${acceptedBody.accessToken}` } });
  expect(deniedTeam.status).toBe(403);
});
