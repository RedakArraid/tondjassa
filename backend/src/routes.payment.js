const express = require('express');
const { z } = require('zod');
const router = express.Router();
const db = require('./db');
const { optionalAuth } = require('./middleware.auth');
const { assertOrderAccess } = require('./services/order-access.service');
const PaymentService = require('./services/payment.service');
const paystackService = require('./services/paystack.service');
const cinetpayService = require('./services/cinetpay.service');
const stripeService = require('./services/stripe.service');

const initiateSchema = z.object({
  orderId: z.string().uuid('ID de commande invalide'),
  gateway: z.string().optional(),
  returnBaseUrl: z.string().url().optional(),
  operatorGateway: z.string().optional(),
});

// POST /api/payment/initiate - Initialise le paiement auprès du prestataire (MM-BE-040)
router.post('/initiate', optionalAuth, async (req, res) => {
  try {
    const data = initiateSchema.parse(req.body);
    const order = await db.order.findUnique({ where: { id: data.orderId } });
    assertOrderAccess(req, order);
    res.setHeader('Cache-Control', 'no-store');
    const result = await PaymentService.initializePayment(data);
    res.json(result);
  } catch (err) {
    console.error('[Payment] Erreur initiation:', err.message);
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Données invalides', details: err.errors });
    }
    res.status(err.statusCode || 500).json({ error: err.message || 'Erreur lors de l’initiation du paiement' });
  }
});

// POST /api/payment/webhook/paystack - Webhook Paystack vérifié par HMAC (MM-BE-042)
router.post('/webhook/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const raw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.warn('[Paystack Webhook] PAYSTACK_SECRET_KEY non configuré');
      return res.status(503).send('Webhook non configuré');
    }

    if (!signature || !paystackService.verifyWebhookSignature(raw, signature)) {
      console.warn('[Paystack Webhook] Signature HMAC invalide');
      return res.status(401).send('Signature invalide');
    }

    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return res.status(400).send('JSON invalide');
    }

    console.log('[Paystack Webhook]', event?.event, event?.data?.reference);

    if (event?.event === 'charge.success') {
      const { reference, metadata, status } = event.data || {};
      const orderId = metadata?.orderId;

      if (orderId && status === 'success') {
        // Double vérification serveur-à-serveur de la transaction
        {
          const verified = await paystackService.verifyTransaction(reference);
          if (!verified.status || verified.data?.status !== 'success' || verified.data.metadata?.orderId !== orderId) throw new Error('Verification fournisseur non confirmee');
          if (verified.status && verified.data?.status === 'success') {
            await PaymentService.processPaymentSuccess({
              orderId,
              gateway: 'paystack',
              transactionId: reference,
              amountPaid: verified.data.amount,
              currency: verified.data.currency,
              rawPayload: event,
              eventId: String(event.data?.id || reference),
            });
            console.log(`[Paystack] Paiement vérifié et confirmé pour commande ${orderId}`);
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Paystack Webhook] Traitement non termine:', err.message);
    res.status(503).json({ error: 'Traitement a reessayer' });
  }
});

// POST /api/payment/notify/cinetpay - Notification IPN CinetPay avec check obligatoire (MM-BE-041)
router.post('/notify/cinetpay', async (req, res) => {
  try {
    const { cpm_trans_id } = req.body;
    console.log('[CinetPay Notification reçue]', { cpm_trans_id });

    if (cpm_trans_id) {
      // Vérification serveur-à-serveur infalsifiable (ne jamais utiliser cpm_result seul)
      if (!z.string().uuid().safeParse(cpm_trans_id).success) return res.status(400).send('Reference invalide');
      const checkResult = await cinetpayService.checkPaymentStatus(cpm_trans_id);
      if (!checkResult) return res.status(503).send('Verification indisponible');

      if (checkResult && checkResult.isSuccess) {
        await PaymentService.processPaymentSuccess({
          orderId: cpm_trans_id,
          gateway: 'cinetpay',
          transactionId: cpm_trans_id,
          amountPaid: checkResult.amount,
          currency: checkResult.currency,
          rawPayload: checkResult.rawData,
          eventId: `cinetpay_${cpm_trans_id}_${checkResult.paymentDate || 'accepted'}`,
        });
        console.log(`[CinetPay] Paiement vérifié avec succès pour commande ${cpm_trans_id}`);
      } else if (checkResult && checkResult.status === 'REFUSED') {
        await PaymentService.processPaymentFailure({
          orderId: cpm_trans_id,
          gateway: 'cinetpay',
          transactionId: cpm_trans_id,
          reason: 'Paiement refusé par CinetPay',
          rawPayload: checkResult.rawData,
          eventId: `cinetpay_${cpm_trans_id}_refused`,
        });
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('[CinetPay Webhook] Traitement non termine:', err.message);
    res.status(503).send('Traitement a reessayer');
  }
});

// POST /api/payment/webhook/stripe - Webhook Stripe sécurisé (MM-BE-043)
router.post('/webhook/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = await stripeService.constructWebhookEvent(req.body, sig);
    } catch (err) {
      console.error('[Stripe Webhook] Signature invalide:', err.message);
      return res.status(400).send('Signature invalide');
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId || session.client_reference_id;

      if (orderId && session.payment_status === 'paid') {
        await PaymentService.processPaymentSuccess({
          orderId,
          gateway: 'stripe',
          transactionId: session.id,
          amountPaid: session.amount_total,
          currency: session.currency?.toUpperCase(),
          rawPayload: session,
          eventId: event.id,
        });
        console.log(`[Stripe] Paiement confirmé pour commande ${orderId}`);
      }
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId || session.client_reference_id;
      if (orderId) {
        await PaymentService.processPaymentFailure({
          orderId,
          gateway: 'stripe',
          transactionId: session.id,
          reason: 'Paiement asynchrone échoué',
          rawPayload: session,
          eventId: event.id,
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook] Erreur:', err);
    res.status(500).json({ error: 'Erreur webhook' });
  }
});

// GET /api/payment/status/:orderId - Statut autoritaire du paiement (MM-FE-040)
router.get('/status/:orderId', optionalAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = await db.payment.findUnique({ where: { orderId } });
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true, totalAmount: true, currency: true, userId: true, customerId: true, checkoutSecretHash: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    assertOrderAccess(req, order);
    res.setHeader('Cache-Control', 'no-store');
    const isPaid = payment?.status === 'COMPLETED' && order.status !== 'CANCELLED';

    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentStatus: payment?.status || 'PENDING',
      isPaid,
      payment: payment ? {
        id: payment.id,
        method: payment.method,
        gateway: payment.gateway,
        status: payment.status,
        amount: payment.amount,
        transactionId: payment.transactionId,
        updatedAt: payment.updatedAt,
      } : null,
    });
  } catch (err) {
    console.error('Erreur récupération statut paiement:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Erreur serveur' });
  }
});

// GET /api/payment/verify/:gateway/:reference - Vérification serveur à la demande
router.get('/verify/:gateway/:reference', optionalAuth, async (req, res) => {
  try {
    const { gateway, reference } = req.params;
    const payment = await db.payment.findFirst({ where: { gateway, transactionId: reference }, include: { order: true } });
    assertOrderAccess(req, payment?.order);
    res.setHeader('Cache-Control', 'no-store');

    if (gateway === 'paystack') {
      const data = await paystackService.verifyTransaction(reference);
      if (data.status && data.data?.status === 'success') {
        const orderId = data.data.metadata?.orderId;
        if (orderId) {
          const result = await PaymentService.processPaymentSuccess({
            orderId,
            gateway: 'paystack',
            transactionId: reference,
            amountPaid: data.data.amount,
            currency: data.data.currency,
            rawPayload: data,
            eventId: `verify_${reference}`,
          });
          return res.json({ verified: true, status: 'COMPLETED', order: result.order });
        }
      }
      return res.json({ verified: false, status: data.data?.status || 'PENDING' });
    }

    if (gateway === 'cinetpay') {
      const checkResult = await cinetpayService.checkPaymentStatus(reference);
      if (checkResult && checkResult.isSuccess) {
        const result = await PaymentService.processPaymentSuccess({
          orderId: reference,
          gateway: 'cinetpay',
          transactionId: reference,
          amountPaid: checkResult.amount,
          currency: checkResult.currency,
          rawPayload: checkResult.rawData,
          eventId: `verify_${reference}`,
        });
        return res.json({ verified: true, status: 'COMPLETED', order: result.order });
      }
      return res.json({ verified: false, status: checkResult?.status || 'PENDING' });
    }

    res.status(400).json({ error: `Passerelle ${gateway} non prise en charge pour vérification manuelle` });
  } catch (err) {
    console.error('Erreur vérification manuelle paiement:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Erreur serveur' });
  }
});

module.exports = router;
