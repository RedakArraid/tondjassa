const db = require('../db');
const { transaction, lockOrder, httpError } = require('./transaction');
const Ledger = require('./ledger.service');
const { OrderService } = require('./order.service');
const { expectedPayment } = require('./payment.service');
const { getStripe } = require('./stripe.service');
const Paystack = require('./paystack.service');
const ps = async (path, options = {}) => {
  if (!process.env.PAYSTACK_SECRET_KEY) throw httpError('Paystack non configure', 503);
  const response = await fetch(`https://api.paystack.co${path}`, { ...options, signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok || !data.status) throw new Error('Verification remboursement Paystack indisponible');
  return data.data;
};
class RefundService {
  static async request(orderId, { reason, userId, restock = false } = {}) {
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
      if (!order || !['CANCELLED', 'DELIVERED', 'REFUNDED'].includes(order.status)) throw httpError('Commande non eligible');
      const existing = await tx.refund.findUnique({ where: { orderId } });
      if (existing) return existing;
      if (order.payment?.status !== 'COMPLETED') throw httpError('Aucun paiement complete a rembourser');
      const refund = await tx.refund.create({ data: { orderId, gateway: order.payment.gateway || 'manual',
        transactionId: order.payment.transactionId, amount: order.totalAmount, currency: 'XOF', reason,
        restockRequested: restock && order.status === 'DELIVERED', status: 'REQUESTED' } });
      await tx.auditLog.create({ data: { userId, action: 'REFUND_REQUESTED', entity: 'Refund', entityId: refund.id,
        details: { orderId, amount: refund.amount, restockRequested: refund.restockRequested } } });
      return refund;
    });
  }
  static async process(refundId) {
    const initial = await db.refund.findUnique({ where: { id: refundId } });
    if (!initial) throw httpError('Remboursement introuvable', 404);
    const claim = await transaction(async (tx) => {
      await lockOrder(tx, initial.orderId);
      const refund = await tx.refund.findUnique({ where: { id: refundId }, include: { order: { include: { payment: true } } } });
      if (refund.status === 'COMPLETED') return { refund, done: true };
      if (!['stripe', 'paystack'].includes(refund.gateway)) {
        return { refund: await tx.refund.update({ where: { id: refundId }, data: { status: 'MANUAL_REQUIRED' } }), done: true };
      }
      const submit = refund.status === 'REQUESTED';
      if (submit) await tx.refund.update({ where: { id: refundId }, data: { status: 'SUBMITTING', submittedAt: new Date() } });
      return { refund, submit };
    });
    if (claim.done) return claim.refund;
    const { refund, submit } = claim;
    const expected = expectedPayment(refund.order, refund.gateway);
    try {
      let receipt;
      if (refund.gateway === 'stripe') {
        const stripe = getStripe();
        const checkout = await stripe.checkout.sessions.retrieve(refund.transactionId);
        if (!checkout.payment_intent) throw new Error('PaymentIntent manquant');
        if (refund.providerReference) receipt = await stripe.refunds.retrieve(refund.providerReference);
        else if (submit || (refund.submittedAt && Date.now() - refund.submittedAt.getTime() < 23 * 3600000)) {
          receipt = await stripe.refunds.create({ payment_intent: checkout.payment_intent, amount: expected.amount,
            metadata: { refundId } }, { idempotencyKey: `refund-${refundId}` });
        } else throw new Error('Resultat ambigu: verification manuelle requise, aucun nouvel appel de remboursement');
        if (receipt.payment_intent !== checkout.payment_intent) throw new Error('Transaction de remboursement incoherente');
      } else {
        const verified = await Paystack.verifyTransaction(refund.transactionId);
        const transactionId = verified.data?.id;
        if (!verified.status || !transactionId) throw new Error('Transaction fournisseur introuvable');
        if (refund.providerReference) receipt = await ps(`/refund/${encodeURIComponent(refund.providerReference)}`);
        else if (submit) receipt = await ps('/refund', { method: 'POST', body: JSON.stringify({ transaction: refund.transactionId,
          amount: expected.amount, currency: expected.currency, merchant_note: `tondjassa-refund:${refundId}` }) });
        else {
          // Never blindly retry a POST after an ambiguous network failure.
          const results = await ps(`/refund?transaction=${transactionId}&perPage=100`);
          receipt = results.find((item) => item.merchant_note === `tondjassa-refund:${refundId}`);
          if (!receipt) throw new Error('Resultat ambigu: reconciliation manuelle requise');
        }
        const receiptTransaction = typeof receipt.transaction === 'object' ? receipt.transaction.id : receipt.transaction;
        if (String(receiptTransaction) !== String(transactionId)) throw new Error('Reference de remboursement incoherente');
      }
      if (Number(receipt.amount) !== expected.amount || receipt.currency?.toUpperCase() !== expected.currency) throw new Error('Montant de remboursement incoherent');
      const status = ['succeeded', 'processed'].includes(receipt.status) ? 'CONFIRMED' : ['failed', 'canceled'].includes(receipt.status) ? 'FAILED' : 'PENDING';
      await db.refund.updateMany({ where: { id: refundId, status: { not: 'COMPLETED' } }, data: {
        providerReference: String(receipt.id), status: status === 'CONFIRMED' ? 'PENDING' : status, error: null } });
      return status === 'CONFIRMED' ? this.finalize(refundId, String(receipt.id)) : db.refund.findUnique({ where: { id: refundId } });
    } catch (error) {
      await db.refund.updateMany({ where: { id: refundId, status: { not: 'COMPLETED' } }, data: { status: 'UNKNOWN', error: error.message.slice(0, 500) } });
      throw httpError('Remboursement non confirme; verification fournisseur requise', 503);
    }
  }
  static async finalize(refundId, reference, userId = null) {
    const initial = await db.refund.findUnique({ where: { id: refundId } });
    if (!initial) throw httpError('Remboursement introuvable', 404);
    return transaction(async (tx) => {
      await lockOrder(tx, initial.orderId);
      const refund = await tx.refund.findUnique({ where: { id: refundId }, include: { order: { include: { payment: true, items: true } } } });
      if (refund.status === 'COMPLETED') return refund;
      if (!reference || refund.order.payment?.status !== 'COMPLETED') throw httpError('Paiement non remboursable');
      const order = refund.order;
      if (order.status === 'DELIVERED') await OrderService.transitionOrderStatus(order.id, 'REFUNDED', {
        userId, reason: refund.reason, refundConfirmed: true, restock: refund.restockRequested }, tx);
      else if (order.status === 'CANCELLED') await Ledger.recordOrderRefund(order.id, { reason: refund.reason }, tx);
      else throw httpError('Statut de commande incoherent');
      const settlement = await tx.paymentEvent.findUnique({ where: { idempotencyKey: `settlement:${order.id}` } });
      if (settlement?.payload?.credited) {
        await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: { decrement: order.totalAmount } } });
        for (const item of [...order.items].sort((a, b) => String(a.sellerId).localeCompare(String(b.sellerId)))) {
          if (item.sellerId) await tx.seller.update({ where: { id: item.sellerId }, data: {
            totalSales: { decrement: item.totalPrice }, totalEarnings: { decrement: item.sellerEarnings } } });
        }
      }
      await tx.payment.update({ where: { id: order.payment.id }, data: { status: 'REFUNDED' } });
      await tx.returnRequest.updateMany({ where: { orderId: order.id, status: 'approved' }, data: { status: 'completed' } });
      const updated = await tx.refund.update({ where: { id: refundId }, data: { status: 'COMPLETED', providerReference: reference, completedAt: new Date(), error: null } });
      await tx.auditLog.create({ data: { userId, action: 'REFUND_COMPLETED', entity: 'Refund', entityId: refundId,
        details: { reference, gateway: refund.gateway, amount: refund.amount, manualAttestation: !!userId } } });
      return updated;
    });
  }
}
module.exports = RefundService;
