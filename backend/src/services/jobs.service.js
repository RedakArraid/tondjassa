const db = require('../db');
const Payments = require('./payment.service');
const Refunds = require('./refund.service');
const { OrderService } = require('./order.service');
async function runJobs() {
  const summary = { paymentsChecked: 0, refundsChecked: 0, failed: 0 };
  const payments = await db.payment.findMany({ where: { status: 'PROCESSING', gateway: { in: ['paystack', 'cinetpay', 'stripe'] } },
    orderBy: { updatedAt: 'asc' }, take: 50 });
  for (const p of payments) {
    try {
      let success = false, failure = false, amount, currency;
      if (p.gateway === 'paystack') {
        const response = await require('./paystack.service').verifyTransaction(p.transactionId);
        if (!response.status || !response.data) throw new Error('Verification Paystack indisponible');
        if (response.data.metadata?.orderId !== p.orderId) throw new Error('Reference Paystack incoherente');
        success = response.data.status === 'success'; failure = ['failed', 'abandoned'].includes(response.data.status);
        amount = response.data.amount; currency = response.data.currency;
      } else if (p.gateway === 'cinetpay') {
        const response = await require('./cinetpay.service').checkPaymentStatus(p.transactionId);
        if (!response) throw new Error('Verification CinetPay indisponible');
        success = response.isSuccess; failure = response.status === 'REFUSED'; amount = response.amount; currency = response.currency;
      } else {
        if (!p.transactionId) throw new Error('Session Stripe inconnue: rapprochement manuel requis');
        const response = await require('./stripe.service').getStripe().checkout.sessions.retrieve(p.transactionId);
        if (response.metadata?.orderId !== p.orderId) throw new Error('Reference Stripe incoherente');
        success = response.payment_status === 'paid'; failure = response.status === 'expired'; amount = response.amount_total; currency = response.currency;
      }
      if (success) await Payments.processPaymentSuccess({ orderId: p.orderId, gateway: p.gateway, transactionId: p.transactionId,
        amountPaid: amount, currency, eventId: `reconcile:${p.id}` });
      else if (failure) await Payments.processPaymentFailure({ orderId: p.orderId, gateway: p.gateway, transactionId: p.transactionId, reason: 'Echec confirme par le prestataire', eventId: `reconcile:${p.id}` });
      else await db.payment.updateMany({ where: { id: p.id, status: 'PROCESSING' }, data: { updatedAt: new Date() } });
      summary.paymentsChecked++;
    } catch (error) { summary.failed++; console.error(JSON.stringify({ event: 'PAYMENT_RECONCILIATION_REQUIRED', paymentId: p.id, error: error.message })); }
  }
  const refunds = await db.refund.findMany({ where: { status: { in: ['REQUESTED', 'SUBMITTING', 'PENDING', 'UNKNOWN'] } }, orderBy: { updatedAt: 'asc' }, take: 50 });
  for (const refund of refunds) {
    try { await Refunds.process(refund.id); summary.refundsChecked++; }
    catch (error) { summary.failed++; console.error(JSON.stringify({ event: 'REFUND_RECONCILIATION_REQUIRED', refundId: refund.id, error: error.message })); }
  }
  const expired = await OrderService.expirePendingOrders(60);
  return { ...summary, ...expired };
}
module.exports = { runJobs };
