const db = require('../db');
const Payments = require('./payment.service');
const Refunds = require('./refund.service');
const Emails = require('./email.service');
const { OrderService } = require('./order.service');

async function verifyProcessingPayment(payment) {
  if (payment.gateway === 'paystack') {
    if (!payment.transactionId) throw new Error('Reference Paystack absente');
    const response = await require('./paystack.service').verifyTransaction(payment.transactionId);
    if (!response.status || !response.data) throw new Error('Verification Paystack indisponible');
    if (response.data.metadata?.orderId !== payment.orderId) throw new Error('Reference Paystack incoherente');
    return { success: response.data.status === 'success', failure: ['failed', 'abandoned'].includes(response.data.status),
      amount: response.data.amount, currency: response.data.currency };
  }
  if (payment.gateway === 'stripe') {
    if (!payment.transactionId) throw new Error('Session Stripe inconnue');
    const response = await require('./stripe.service').getStripe().checkout.sessions.retrieve(payment.transactionId);
    if (response.metadata?.orderId !== payment.orderId) throw new Error('Reference Stripe incoherente');
    return { success: response.payment_status === 'paid', failure: response.status === 'expired',
      amount: response.amount_total, currency: response.currency };
  }
  throw new Error('Passerelle de rapprochement invalide');
}

async function runJobs() {
  const summary = { paymentsChecked: 0, paymentsExpired: 0, refundsChecked: 0, emailsSent: 0, emailsFailed: 0, failed: 0 };
  const payments = await db.payment.findMany({ where: { status: 'PROCESSING', gateway: { in: ['paystack', 'stripe'] } },
    orderBy: [{ processingExpiresAt: 'asc' }, { updatedAt: 'asc' }], take: 50 });
  for (const payment of payments) {
    const expired = !payment.processingExpiresAt || payment.processingExpiresAt <= new Date();
    try {
      const result = await verifyProcessingPayment(payment);
      if (result.success) {
        await Payments.processPaymentSuccess({ orderId: payment.orderId, gateway: payment.gateway, transactionId: payment.transactionId,
          amountPaid: result.amount, currency: result.currency, eventId: `reconcile:${payment.id}` });
      } else if (result.failure || expired) {
        await Payments.processPaymentFailure({ orderId: payment.orderId, gateway: payment.gateway, transactionId: payment.transactionId,
          reason: result.failure ? 'Echec confirme par le prestataire' : 'Delai de paiement expire apres verification prestataire',
          eventId: `reconcile-timeout:${payment.id}` });
        summary.paymentsExpired++;
      }
      summary.paymentsChecked++;
    } catch (error) {
      const attempts = payment.verificationAttempts + 1;
      if (expired && attempts >= 3) {
        try {
          await Payments.processPaymentFailure({ orderId: payment.orderId, gateway: payment.gateway,
            transactionId: payment.transactionId, reason: 'Delai maximal de rapprochement depasse',
            eventId: `reconcile-unavailable:${payment.id}` });
          summary.paymentsExpired++;
        } catch (failureError) {
          summary.failed++;
          console.error(JSON.stringify({ event: 'PAYMENT_EXPIRATION_FAILED', paymentId: payment.id, error: failureError.message }));
        }
      } else {
        await db.payment.updateMany({ where: { id: payment.id, status: 'PROCESSING' }, data: {
          verificationAttempts: attempts,
          ...(expired ? { processingExpiresAt: new Date(Date.now() + 5 * 60000) } : {}),
        } });
        summary.failed++;
        console.error(JSON.stringify({ event: 'PAYMENT_RECONCILIATION_REQUIRED', paymentId: payment.id, attempt: attempts, error: error.message }));
      }
    }
  }
  const refunds = await db.refund.findMany({ where: { status: { in: ['REQUESTED', 'SUBMITTING', 'PENDING', 'UNKNOWN'] } }, orderBy: { updatedAt: 'asc' }, take: 50 });
  for (const refund of refunds) {
    try { await Refunds.process(refund.id); summary.refundsChecked++; }
    catch (error) { summary.failed++; console.error(JSON.stringify({ event: 'REFUND_RECONCILIATION_REQUIRED', refundId: refund.id, error: error.message })); }
  }
  const emailResult = await Emails.processOutboxBatch();
  summary.emailsSent = emailResult.sent;
  summary.emailsFailed = emailResult.failed;
  const expiredOrders = await OrderService.expirePendingOrders(60);
  return { ...summary, ...expiredOrders };
}

module.exports = { runJobs, verifyProcessingPayment };
