const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { httpError } = require('./transaction');
const key = crypto.createHmac('sha256', JWT_SECRET).update('order-capability-v1').digest('hex');
function createOrderToken(orderId) {
  return jwt.sign({ orderId }, key, { algorithm: 'HS256', audience: 'order', issuer: 'tondjassa', expiresIn: '30d' });
}
function assertOrderAccess(req, order) {
  if (!order) throw httpError('Commande introuvable', 404);
  if (['admin', 'manager'].includes(req.user?.role)) return;
  if (req.user?.userId && (req.user.userId === order.userId || req.user.customerId === order.customerId)) return;
  const secret = req.headers['x-order-token'];
  if (typeof secret === 'string' && secret.length <= 2048) {
    if (/^[a-f0-9]{64}$/.test(secret) && order.checkoutSecretHash) {
      const hash = crypto.createHash('sha256').update(secret).digest();
      const expected = Buffer.from(order.checkoutSecretHash, 'hex');
      if (hash.length === expected.length && crypto.timingSafeEqual(hash, expected)) return;
    }
    try {
      const token = jwt.verify(secret, key, { algorithms: ['HS256'], audience: 'order', issuer: 'tondjassa' });
      if (token.orderId === order.id) return;
    } catch { /* Not an order capability. Never treat it as a user token. */ }
  }
  throw httpError('Commande introuvable', 404);
}
function publicOrder(order) {
  const { checkoutSecretHash: _hash, idempotencyKey: _key, user: _user, customer: _customer, ...safe } = order;
  if (safe.payment) {
    const { metadata: _metadata, ...payment } = safe.payment;
    safe.payment = payment;
  }
  safe.customer = { ...order.customerSnapshot, address: order.shippingAddress };
  return safe;
}
module.exports = { assertOrderAccess, createOrderToken, publicOrder };
