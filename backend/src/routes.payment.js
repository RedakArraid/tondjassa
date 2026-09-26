const express = require('express');
const { z } = require('zod');
const router = express.Router();
const db = require('./db');
const { optionalAuth } = require('./middleware.auth');
const { assertOrderAccess } = require('./services/order-access.service');
const { detectRegion, getCheckoutCountries, isCheckoutCountryEnabled } = require('./utils/region');
const PaymentService = require('./services/payment.service');
const paystackService = require('./services/paystack.service');
const stripeService = require('./services/stripe.service');

const onlineGateway = z.enum(['paystack', 'stripe']);
const operator = z.enum(['mtn_momo', 'orange_money', 'wave']);
const initiateSchema = z.object({
  orderId: z.string().uuid('ID de commande invalide'),
  gateway: z.union([onlineGateway, operator]).optional(),
  returnBaseUrl: z.string().url().max(500).optional(),
  operatorGateway: operator.optional(),
}).strict();
const countrySchema = z.object({ country: z.string().trim().length(2).transform((value) => value.toUpperCase()) }).strict();
const statusParams = z.object({ orderId: z.string().uuid() }).strict();
const verifyParams = z.object({ gateway: onlineGateway, reference: z.string().trim().min(3).max(200).regex(/^[A-Za-z0-9_-]+$/) }).strict();

router.get('/providers', (req, res) => {
  try {
    const { country } = countrySchema.parse(req.query);
    const region = detectRegion(country);
    const enabledCountries = getCheckoutCountries();
    if (!isCheckoutCountryEnabled(country)) {
      return res.status(422).json({ error: 'Livraison indisponible pour ce pays', region, providers: [], enabledCountries });
    }
    const providers = [];
    if (country === 'CI') providers.push({
      gateway: 'cash_on_delivery', label: 'Paiement à la livraison', methods: ['cash'],
    });
    // MandeMarket prices African orders in XOF; Paystack supports XOF for its
    // Côte d'Ivoire market. Other Paystack markets require their local currency.
    if (country === 'CI' && paystackService.isConfigured()) providers.push({
      gateway: 'paystack', label: 'Paystack', methods: ['card', 'mobile_money', 'mtn_momo', 'orange_money', 'wave'],
    });
    if (region === 'europe' && stripeService.isConfigured()) providers.push({
      gateway: 'stripe', label: 'Stripe', methods: ['card', 'sepa_debit'],
    });
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ region, providers, enabledCountries });
  } catch (error) {
    res.status(400).json({ error: 'Pays invalide', details: error.errors });
  }
});

router.post('/initiate', optionalAuth, async (req, res) => {
  try {
    const data = initiateSchema.parse(req.body);
    const order = await db.order.findUnique({ where: { id: data.orderId } });
    assertOrderAccess(req, order);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await PaymentService.initializePayment(data));
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Données invalides', details: err.errors });
    console.error('[Payment] Erreur initiation:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message || 'Erreur lors de l’initiation du paiement' });
  }
});

router.post('/webhook/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (!paystackService.isConfigured()) return res.status(503).send('Webhook non configuré');
    if (!signature || !paystackService.verifyWebhookSignature(raw, signature)) return res.status(401).send('Signature invalide');
    let event;
    try { event = JSON.parse(raw); } catch { return res.status(400).send('JSON invalide'); }
    const reference = event?.data?.reference;
    const orderId = event?.data?.metadata?.orderId;
    if (event?.event === 'charge.success' && reference && orderId) {
      const verified = await paystackService.verifyTransaction(reference);
      if (!verified.status || verified.data?.status !== 'success' || verified.data.metadata?.orderId !== orderId) throw new Error('Verification fournisseur non confirmee');
      await PaymentService.processPaymentSuccess({ orderId, gateway: 'paystack', transactionId: reference,
        amountPaid: verified.data.amount, currency: verified.data.currency, rawPayload: event,
        eventId: String(event.data?.id || reference) });
    } else if (event?.event === 'charge.failed' && reference && orderId) {
      const verified = await paystackService.verifyTransaction(reference);
      if (!verified.status || !['failed', 'abandoned'].includes(verified.data?.status) || verified.data.metadata?.orderId !== orderId) throw new Error('Echec fournisseur non confirme');
      await PaymentService.processPaymentFailure({ orderId, gateway: 'paystack', transactionId: reference,
        reason: 'Paiement refuse par Paystack', eventId: String(event.data?.id || reference) });
    } else if (event?.event === 'refund.processed') {
      const transactionReference = event.data?.transaction_reference || event.data?.transaction?.reference;
      const providerReference = event.data?.refund_reference || String(event.data?.id || '');
      const amount = Number(event.data?.amount);
      const currency = String(event.data?.currency || event.data?.transaction?.currency || '').toUpperCase();
      if (!transactionReference || !providerReference || !Number.isSafeInteger(amount)) throw new Error('Remboursement Paystack incomplet');
      const payment = await db.payment.findFirst({ where: { gateway: 'paystack', transactionId: transactionReference } });
      if (!payment) throw new Error('Paiement Paystack introuvable');
      const verified = await paystackService.verifyTransaction(transactionReference);
      if (!verified.status || verified.data?.metadata?.orderId !== payment.orderId) throw new Error('Transaction Paystack non confirmee');
      const eventId = String(event.data?.id || providerReference);
      if (amount !== payment.amount || currency !== 'XOF') {
        await PaymentService.recordProviderAlert({ orderId: payment.orderId, gateway: 'paystack',
          transactionId: transactionReference, eventId, eventType: 'PROVIDER_PARTIAL_REFUND',
          payload: { providerReference, amount, currency } });
      } else {
        await PaymentService.processProviderReversal({ orderId: payment.orderId, gateway: 'paystack',
          transactionId: transactionReference, providerReference, amount, currency, eventId, kind: 'PROVIDER_REFUND' });
      }
    } else if (['charge.dispute.create', 'charge.dispute.remind', 'charge.dispute.resolve'].includes(event?.event)) {
      const transactionReference = event.data?.transaction_reference || event.data?.transaction?.reference || reference;
      if (!transactionReference) throw new Error('Litige Paystack sans transaction');
      const payment = await db.payment.findFirst({ where: { gateway: 'paystack', transactionId: transactionReference } });
      if (!payment) throw new Error('Paiement Paystack litigieux introuvable');
      await PaymentService.recordProviderAlert({ orderId: payment.orderId, gateway: 'paystack',
        transactionId: transactionReference, eventId: String(event.data?.id || `${event.event}:${transactionReference}`),
        eventType: 'PAYSTACK_DISPUTE', payload: { providerEvent: event.event,
          providerReference: String(event.data?.id || ''), status: String(event.data?.status || '') } });
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Paystack Webhook] Traitement non termine:', err.message);
    res.status(503).json({ error: 'Traitement a reessayer' });
  }
});

async function stripeContext(object) {
  const stripe = stripeService.getStripe();
  if (object.object === 'checkout.session') return {
    orderId: object.metadata?.orderId || object.client_reference_id, transactionId: object.id,
  };
  let paymentIntentId = object.object === 'payment_intent' ? object.id : object.payment_intent;
  if (!paymentIntentId && object.charge) {
    const charge = await stripe.charges.retrieve(typeof object.charge === 'string' ? object.charge : object.charge.id);
    paymentIntentId = charge.payment_intent;
  }
  if (!paymentIntentId && object.object === 'charge') paymentIntentId = object.payment_intent;
  if (!paymentIntentId) return {};
  const intent = await stripe.paymentIntents.retrieve(typeof paymentIntentId === 'string' ? paymentIntentId : paymentIntentId.id);
  const sessions = await stripe.checkout.sessions.list({ payment_intent: intent.id, limit: 1 });
  const session = sessions.data?.[0];
  return {
    orderId: object.metadata?.orderId || intent.metadata?.orderId || session?.metadata?.orderId || session?.client_reference_id,
    transactionId: session?.id,
  };
}

router.post('/webhook/stripe', async (req, res) => {
  try {
    let event;
    try { event = await stripeService.constructWebhookEvent(req.body, req.headers['stripe-signature']); }
    catch { return res.status(400).send('Signature invalide'); }
    const object = event.data.object;
    const context = await stripeContext(object);
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      if (context.orderId && object.payment_status === 'paid') await PaymentService.processPaymentSuccess({
        orderId: context.orderId, gateway: 'stripe', transactionId: context.transactionId,
        amountPaid: object.amount_total, currency: object.currency?.toUpperCase(), rawPayload: object, eventId: event.id,
      });
    } else if (['checkout.session.async_payment_failed', 'checkout.session.expired', 'payment_intent.payment_failed'].includes(event.type)) {
      if (context.orderId && context.transactionId) await PaymentService.processPaymentFailure({
        orderId: context.orderId, gateway: 'stripe', transactionId: context.transactionId,
        reason: event.type === 'checkout.session.expired' ? 'Session Stripe expiree' : 'Paiement Stripe echoue', eventId: event.id,
      });
    } else if (event.type === 'charge.refunded' && object.refunded) {
      if (context.orderId && context.transactionId) await PaymentService.processProviderReversal({
        orderId: context.orderId, gateway: 'stripe', transactionId: context.transactionId,
        providerReference: object.id, amount: object.amount_refunded, currency: object.currency,
        eventId: event.id, kind: 'PROVIDER_REFUND',
      });
    } else if (event.type === 'refund.updated' && object.status === 'succeeded') {
      if (context.orderId && context.transactionId) await PaymentService.processProviderReversal({
        orderId: context.orderId, gateway: 'stripe', transactionId: context.transactionId,
        providerReference: object.id, amount: object.amount, currency: object.currency,
        eventId: event.id, kind: 'PROVIDER_REFUND',
      });
    } else if (['charge.dispute.created', 'charge.dispute.funds_withdrawn'].includes(event.type)) {
      if (context.orderId && context.transactionId) await PaymentService.processProviderReversal({
        orderId: context.orderId, gateway: 'stripe', transactionId: context.transactionId,
        providerReference: object.id, amount: object.amount, currency: object.currency,
        eventId: event.id, kind: 'CHARGEBACK',
      });
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook] Traitement non termine:', err.message);
    res.status(503).json({ error: 'Traitement a reessayer' });
  }
});

router.get('/status/:orderId', optionalAuth, async (req, res) => {
  try {
    const { orderId } = statusParams.parse(req.params);
    const [payment, order] = await Promise.all([
      db.payment.findUnique({ where: { orderId } }),
      db.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, status: true, totalAmount: true, currency: true, userId: true, customerId: true, checkoutSecretHash: true } }),
    ]);
    if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
    assertOrderAccess(req, order);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ orderId: order.id, orderNumber: order.orderNumber, orderStatus: order.status,
      paymentStatus: payment?.status || 'PENDING', isPaid: payment?.status === 'COMPLETED' && order.status !== 'CANCELLED',
      payment: payment ? { id: payment.id, method: payment.method, gateway: payment.gateway, status: payment.status,
        amount: payment.amount, transactionId: payment.transactionId, updatedAt: payment.updatedAt } : null });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Identifiant invalide' });
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Erreur serveur' });
  }
});

router.get('/verify/:gateway/:reference', optionalAuth, async (req, res) => {
  try {
    const { gateway, reference } = verifyParams.parse(req.params);
    const payment = await db.payment.findFirst({ where: { gateway, transactionId: reference }, include: { order: true } });
    assertOrderAccess(req, payment?.order);
    res.setHeader('Cache-Control', 'no-store');
    if (gateway === 'paystack') {
      const data = await paystackService.verifyTransaction(reference);
      if (data.status && data.data?.status === 'success') {
        const result = await PaymentService.processPaymentSuccess({ orderId: payment.orderId, gateway, transactionId: reference,
          amountPaid: data.data.amount, currency: data.data.currency, rawPayload: data, eventId: `verify_${reference}` });
        return res.json({ verified: true, status: 'COMPLETED', order: result.order });
      }
      return res.json({ verified: false, status: data.data?.status || 'PENDING' });
    }
    const session = await stripeService.getStripe().checkout.sessions.retrieve(reference);
    if (session.metadata?.orderId !== payment.orderId) throw Object.assign(new Error('Reference incoherente'), { statusCode: 409 });
    if (session.payment_status === 'paid') {
      const result = await PaymentService.processPaymentSuccess({ orderId: payment.orderId, gateway, transactionId: reference,
        amountPaid: session.amount_total, currency: session.currency, rawPayload: session, eventId: `verify_${reference}` });
      return res.json({ verified: true, status: 'COMPLETED', order: result.order });
    }
    res.json({ verified: false, status: session.status || 'PENDING' });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Parametres invalides' });
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Erreur serveur' });
  }
});

module.exports = router;
