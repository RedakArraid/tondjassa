const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { assertOrderAccess, createOrderToken } = require('../services/order-access.service');
const { expectedPayment } = require('../services/payment.service');
const Ledger = require('../services/ledger.service');
describe('Production security regressions', () => {
  const secret = crypto.randomBytes(32).toString('hex');
  const order = { id: 'order1', customerId: 'customer1', userId: 'user1', checkoutSecretHash: crypto.createHash('sha256').update(secret).digest('hex') };
  test('an order number alone grants no access', () => {
    expect(() => assertOrderAccess({ headers: {} }, order)).toThrow('introuvable');
  });
  test('another authenticated customer cannot access the order', () => {
    expect(() => assertOrderAccess({ headers: {}, user: { userId: 'other', customerId: 'other' } }, order)).toThrow();
  });
  test('correct guest capability grants access; wrong capability does not', () => {
    expect(() => assertOrderAccess({ headers: { 'x-order-token': secret } }, order)).not.toThrow();
    expect(() => assertOrderAccess({ headers: { 'x-order-token': 'a'.repeat(64) } }, order)).toThrow();
  });
  test('emailed capability is scoped to an order and a different audience', () => {
    const token = createOrderToken('order1');
    expect(jwt.decode(token).aud).toBe('order');
    expect(() => assertOrderAccess({ headers: { 'x-order-token': token } }, order)).not.toThrow();
    expect(() => assertOrderAccess({ headers: { 'x-order-token': token } }, { ...order, id: 'other' })).toThrow();
  });
  test('provider units and currency are explicit', () => {
    expect(() => expectedPayment({ totalAmount: 100000, currency: 'XOF' }, 'stripe')).toThrow();
    expect(expectedPayment({ totalAmount: 100000, currency: 'XOF', shippingAddress: { country: 'CI' } }, 'paystack')).toEqual({ amount: 100000, currency: 'XOF' });
    expect(() => expectedPayment({ totalAmount: 100000, currency: 'XOF', shippingAddress: { country: 'SN' } }, 'paystack')).toThrow();
    expect(expectedPayment({ totalAmount: 655957, currency: 'EUR' }, 'stripe')).toEqual({ amount: 1000, currency: 'EUR' });
    expect(() => expectedPayment({ totalAmount: 100000, currency: 'EUR' }, 'paystack')).toThrow();
  });
  test.each([NaN, Infinity, -1, 0, 500000.1, Number.MAX_SAFE_INTEGER + 1])('payout rejects invalid amount %p', async (amount) => {
    await expect(Ledger.requestPayout({ sellerId: 'seller', amount })).rejects.toThrow();
  });
});
