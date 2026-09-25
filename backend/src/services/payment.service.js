const db = require('../db');
const { OrderService } = require('./order.service');
const { xofCentimesToEurCents } = require('../utils/region');
const { transaction, lockOrder, httpError } = require('./transaction');
const LedgerService = require('./ledger.service');
const paystackService = require('./paystack.service');
const stripeService = require('./stripe.service');
const cinetpayService = require('./cinetpay.service');

// Internal money is always XOF hundredths. Provider adapters explicitly define
// their units: Stripe EUR cents / whole XOF, Paystack and CinetPay adapter XOF cents.
function expectedPayment(order, gateway) {
  if (gateway === 'manual') return { amount: order.totalAmount, currency: 'XOF' };
  if (gateway === 'stripe') return order.currency === 'EUR'
    ? { amount: xofCentimesToEurCents(order.totalAmount), currency: 'EUR' }
    : { amount: Math.round(order.totalAmount / 100), currency: 'XOF' };
  if (!['paystack', 'cinetpay'].includes(gateway) || order.currency === 'EUR') throw httpError('Passerelle incompatible', 400);
  return { amount: gateway === 'cinetpay' ? Math.round(order.totalAmount / 100) * 100 : order.totalAmount, currency: 'XOF' };
}

class PaymentService {
  static async initializePayment({ orderId, gateway, returnBaseUrl, operatorGateway }) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { include: { address: true } },
        payment: true,
        items: true,
      },
    });

    if (!order) {
      const err = new Error('Commande introuvable');
      err.statusCode = 404;
      throw err;
    }

    if (order.status !== 'PENDING') {
      const err = new Error(`La commande ${order.orderNumber} ne peut plus être payée (statut: ${order.status})`);
      err.statusCode = 409;
      throw err;
    }

    const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    if (returnBaseUrl && new URL(returnBaseUrl).origin !== new URL(BASE_URL).origin) {
      throw httpError('URL de retour non autorisee', 400);
    }
    const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
    const successUrl = `${BASE_URL}/checkout/success?orderId=${orderId}`;
    const cancelUrl = `${BASE_URL}/checkout/cancel?orderId=${orderId}`;

    // Normalisation de la passerelle selon la région
    const isEurope = order.currency === 'EUR';
    // Only immutable checkout snapshots are sent to payment providers.
    order.customer = { ...order.customerSnapshot, address: order.shippingAddress };
    if (!order.customer.email) throw httpError('Identite de facturation manquante', 409);
    let effectiveGateway = gateway?.toLowerCase();

    const CI_MOBILE_OPERATORS = new Set(['mtn_momo', 'orange_money', 'wave', 'moov_money']);
    let operatorSlug = null;
    if (CI_MOBILE_OPERATORS.has(effectiveGateway)) {
      operatorSlug = effectiveGateway;
      effectiveGateway = operatorSlug === 'moov_money' ? 'cinetpay' : 'paystack';
    }

    if (!effectiveGateway) {
      effectiveGateway = isEurope ? 'stripe' : 'paystack';
    }

    // Protection cohérence région
    if (isEurope) {
      effectiveGateway = 'stripe';
    }

    if (effectiveGateway === 'paystack' && !paystackService.isConfigured()) effectiveGateway = 'cinetpay';
    if (!['stripe', 'paystack', 'cinetpay'].includes(effectiveGateway)) throw httpError('Passerelle invalide', 400);
    if ((effectiveGateway === 'cinetpay' && !cinetpayService.isConfigured()) || (effectiveGateway === 'stripe' && !process.env.STRIPE_SECRET_KEY)) throw httpError('Passerelle non configuree', 503);
    // Claim one immutable payment attempt before any external request. A timeout is
    // ambiguous: retain PROCESSING and reconcile it; never create another charge.
    const claim = await transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const current = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
      if (current?.status !== 'PENDING' || !current.payment || current.payment.method !== 'CARD') {
        throw httpError('Commande non eligible au paiement en ligne');
      }
      const payment = current.payment;
      if (payment.status !== 'PENDING') {
        if (payment.status === 'PROCESSING' && payment.metadata?.paymentUrl) {
          return { cached: { paymentUrl: payment.metadata.paymentUrl, gateway: payment.gateway, transactionId: payment.transactionId } };
        }
        throw httpError('Paiement deja initialise; verifiez son statut avant toute nouvelle tentative');
      }
      const reference = effectiveGateway === 'cinetpay' ? orderId : effectiveGateway === 'paystack' ? `MM-${payment.id}` : null;
      await tx.payment.update({ where: { id: payment.id }, data: {
        status: 'PROCESSING', gateway: effectiveGateway, transactionId: reference,
        metadata: { attemptStartedAt: new Date().toISOString() },
      } });
      return { paymentId: payment.id, reference };
    });
    if (claim.cached) return claim.cached;
    let result;

    if (effectiveGateway === 'paystack') {
      if (!paystackService.isConfigured()) {
        // Fallback sécurisé vers CinetPay
        const notifyUrl = `${API_BASE}/api/payment/notify/cinetpay`;
        result = await cinetpayService.initiatePayment({
          orderId,
          amount: order.totalAmount,
          customer: order.customer,
          returnUrl: successUrl,
          notifyUrl,
        });
        effectiveGateway = 'cinetpay';
      } else {
        result = await paystackService.initializeTransaction({
          orderId,
          amount: order.totalAmount,
          email: order.customer.email,
          callbackUrl: successUrl,
          mobilePhone: order.customer.phone,
          operatorGateway: operatorSlug || operatorGateway,
          reference: claim.reference,
        });
      }
    } else if (effectiveGateway === 'stripe') {
      const currency = isEurope ? 'eur' : 'xof';
      result = await stripeService.createCheckoutSession({
        orderId,
        amount: order.totalAmount,
        customer: order.customer,
        successUrl,
        cancelUrl,
        currency,
        idempotencyKey: `checkout-${claim.paymentId}`,
      });
    } else if (effectiveGateway === 'cinetpay') {
      const notifyUrl = `${API_BASE}/api/payment/notify/cinetpay`;
      result = await cinetpayService.initiatePayment({
        orderId,
        amount: order.totalAmount,
        customer: order.customer,
        returnUrl: successUrl,
        notifyUrl,
      });
    } else {
      const err = new Error(`Passerelle de paiement non supportée: ${effectiveGateway}`);
      err.statusCode = 400;
      throw err;
    }

    const transactionRef = result.sessionId || result.reference || result.transactionId || orderId;

    await transaction(async (tx) => {
      await lockOrder(tx, orderId);
      // A webhook may have completed the payment while initialize was in flight.
      await tx.payment.updateMany({ where: { orderId, status: 'PROCESSING' }, data: {
        gateway: effectiveGateway, transactionId: transactionRef,
        metadata: { paymentUrl: result.paymentUrl, attemptStartedAt: new Date().toISOString() },
      } });
    });

    return {
      paymentUrl: result.paymentUrl,
      gateway: effectiveGateway,
      transactionId: transactionRef,
    };
  }


  static async processPaymentSuccess({ orderId, gateway, transactionId, amountPaid, currency, rawPayload, eventId }, existingTx) {
    if (!transactionId || !eventId) throw httpError('Reference de paiement manquante', 400);
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true, items: true } });
      if (!order?.payment) throw httpError('Commande introuvable', 404);
      const payment = order.payment;
      const expected = expectedPayment(order, gateway);
      if (!Number.isSafeInteger(amountPaid) || amountPaid !== expected.amount || currency?.toUpperCase() !== expected.currency) {
        throw httpError('Montant ou devise du paiement incorrect', 400);
      }
      if (payment.gateway !== gateway || (payment.transactionId && payment.transactionId !== transactionId)) {
        throw httpError('Reference de transaction incoherente', 409);
      }
      // Settlement idempotency is per order, not per webhook event ID.
      if (['COMPLETED', 'REFUNDED'].includes(payment.status)) {
        return { success: true, alreadyProcessed: true, order: { id: order.id, status: order.status } };
      }
      const idempotencyKey = `settlement:${order.id}`;
      const settled = await tx.paymentEvent.findUnique({ where: { idempotencyKey } });
      if (settled?.status === 'PROCESSED') throw httpError('Paiement incoherent: reconciliation requise');
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED', transactionId, gateway } });
      await tx.paymentEvent.create({ data: {
        orderId, paymentId: payment.id, gateway, eventType: 'PAYMENT_SUCCESS', idempotencyKey,
        status: 'PROCESSED', payload: { eventId, transactionId, amountPaid, currency, credited: order.status !== 'CANCELLED', providerStatus: rawPayload?.status || null },
      } });
      if (order.status === 'CANCELLED') {
        // Never resurrect a cancelled order or allocate its released stock.
        await tx.refund.upsert({ where: { orderId }, create: {
          orderId, gateway, transactionId, amount: order.totalAmount, currency: 'XOF',
          reason: 'Paiement recu apres annulation', status: 'REQUESTED',
        }, update: {} });
        return { success: true, refundRequired: true, order: { id: order.id, status: order.status } };
      }
      if (!['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
        throw httpError('Statut de commande incompatible avec ce paiement');
      }
      let updated = order;
      if (order.status === 'PENDING') updated = await OrderService.transitionOrderStatus(orderId, 'CONFIRMED', {
        userId: order.userId, reason: `Paiement confirme: ${gateway}`,
      }, tx);
      if (order.customerId) await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: { increment: order.totalAmount } } });
      // Ledger creates/locks sellers in stable order before changing projections.
      await LedgerService.recordOrderPayment(orderId, tx);
      for (const item of [...order.items].sort((a, b) => String(a.sellerId).localeCompare(String(b.sellerId)))) {
        if (item.sellerId) await tx.seller.update({ where: { id: item.sellerId }, data: {
          totalSales: { increment: item.totalPrice }, totalEarnings: { increment: item.sellerEarnings },
        } });
      }
      if (order.status === 'DELIVERED') await LedgerService.makeOrderFundsAvailable(orderId, tx);
      await tx.auditLog.create({ data: { action: 'PAYMENT_COMPLETED', entity: 'Payment', entityId: payment.id,
        userId: order.userId, details: { gateway, transactionId, amount: order.totalAmount } } });
      return { success: true, alreadyProcessed: false, order: { id: updated.id, status: updated.status } };
    }, existingTx);
  }

  static async recordManualPayment(orderId, { amount, currency, reference, userId }) {
    if (typeof reference !== 'string' || reference.trim().length < 6 || reference.length > 200) throw httpError('Reference du paiement effectif requise', 400);
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
      if (!order?.payment || !['CASH_ON_DELIVERY', 'BANK_TRANSFER'].includes(order.payment.method)) throw httpError('Paiement hors ligne requis');
      if (['CANCELLED', 'REFUNDED'].includes(order.status)) throw httpError('Commande annulee ou remboursee');
      if (amount !== order.totalAmount || currency !== 'XOF') throw httpError('Montant attendu en centiemes XOF', 400);
      if (order.payment.status === 'COMPLETED' && order.payment.transactionId !== reference.trim()) throw httpError('Paiement deja enregistre avec une autre reference');
      await tx.payment.update({ where: { id: order.payment.id }, data: { gateway: 'manual', transactionId: reference.trim() } });
      const result = await this.processPaymentSuccess({ orderId, gateway: 'manual', transactionId: reference.trim(), amountPaid: amount, currency, eventId: `manual:${orderId}` }, tx);
      if (!result.alreadyProcessed) await tx.auditLog.create({ data: { userId, action: 'MANUAL_PAYMENT_ATTESTED', entity: 'Order', entityId: orderId, details: { reference, amount } } });
      return result;
    });
  }

  static async processPaymentFailure({ orderId, gateway, transactionId, reason, eventId }) {
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const payment = await tx.payment.findUnique({ where: { orderId } });
      if (!payment) throw httpError('Commande introuvable', 404);
      if (payment.gateway !== gateway || (payment.transactionId && payment.transactionId !== transactionId)) throw httpError('Reference incoherente');
      if (['COMPLETED', 'REFUNDED'].includes(payment.status)) return { success: true, ignored: true };
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      const key = `${gateway}:failure:${eventId || transactionId}`;
      await tx.paymentEvent.upsert({ where: { idempotencyKey: key }, create: {
        orderId, paymentId: payment.id, gateway, eventType: 'PAYMENT_FAILED', idempotencyKey: key,
        payload: { transactionId, reason }, status: 'PROCESSED',
      }, update: {} });
      return { success: true, status: 'FAILED' };
    });
  }
}
module.exports = PaymentService;
module.exports.expectedPayment = expectedPayment;
