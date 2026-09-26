const db = require('../db');
const crypto = require('node:crypto');
const { transaction, lockOrder, lockKey, httpError } = require('./transaction');
const Inventory = require('./inventory.service');
const PricingService = require('./pricing.service');

const ALLOWED_ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const ALLOWED_PAYMENT_TRANSITIONS = {
  PENDING: ['PROCESSING', 'COMPLETED', 'FAILED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: ['REFUNDED'],
  FAILED: [],
  REFUNDED: [],
};

const ALLOWED_SHIPPING_TRANSITIONS = {
  PENDING: ['PROCESSING', 'SHIPPED'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  RETURNED: [],
};

function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `MM-${dateStr}-${rand}`;
}

class OrderService {
  /**
   * Création atomique et idempotente d'une commande via devis serveur
   */
  static async checkoutOrder({ customerData, addressData, items, shippingMethod, promoCode, paymentMethod, idempotencyKey, checkoutSecret, reqUser, ipAddress, notes }) {
    // 3. Normalisation de la méthode de paiement
    const payMethodMap = {
      cash_on_delivery: 'CASH_ON_DELIVERY',
      bank_transfer: 'BANK_TRANSFER',
      card: 'CARD',
      stripe: 'CARD',
      paystack: 'CARD',
      wave: 'CARD',
      orange_money: 'CARD',
      mtn_momo: 'CARD',
    };
    const normalizedMethod = payMethodMap[paymentMethod?.toLowerCase()] || 'CARD';

    // 4. Transaction PostgreSQL unifiée ($transaction)
    const result = await transaction(async (tx) => {
      if (idempotencyKey) {
        await lockKey(tx, `checkout:${idempotencyKey}`);
        const existing = await tx.order.findUnique({ where: { idempotencyKey }, include: { items: true, payment: true, shipping: true } });
        if (existing) {
          const owned = reqUser?.userId && existing.userId === reqUser.userId;
          const guest = !existing.userId && checkoutSecret && existing.checkoutSecretHash === crypto.createHash('sha256').update(checkoutSecret).digest('hex');
          if (!owned && !guest) throw httpError('Commande non accessible', 404);
          return { order: existing, isDuplicate: true };
        }
      }
    // 2. Recalcul complet et infalsifiable du devis par le PricingService
      const quote = await PricingService.calculateQuote({
      items,
      country: addressData.country || 'CI',
      shippingMethod: shippingMethod || 'STANDARD',
      promoCode,
      }, tx);


      // A. Gestion sécurisée du client sans écrasement furtif (MM-BE-032)
      let customer;
      const normalizedEmail = customerData.email.toLowerCase().trim();

      if (reqUser && reqUser.userId) {
        // Utilisateur authentifié
        customer = await tx.customer.findUnique({ where: { userId: reqUser.userId } });
        if (!customer) {
          customer = await tx.customer.create({
            data: {
              userId: reqUser.userId,
              email: normalizedEmail,
              firstName: customerData.firstName.trim(),
              lastName: customerData.lastName.trim(),
              phone: customerData.phone?.trim() || null,
            },
          });
        }
      } else {
        // Invité : trouver ou créer, mais sans écraser un compte existant
        customer = await tx.customer.findUnique({ where: { email: normalizedEmail } });
        if (!customer) {
          customer = await tx.customer.create({
            data: {
              email: normalizedEmail,
              firstName: customerData.firstName.trim(),
              lastName: customerData.lastName.trim(),
              phone: customerData.phone?.trim() || null,
            },
          });
        }
      }

      // Gestion de l'adresse client
      const existingAddress = await tx.address.findUnique({ where: { customerId: customer.id } });
      if (!existingAddress) {
        await tx.address.create({
          data: {
            customerId: customer.id,
            street: addressData.street,
            city: addressData.city,
            postalCode: addressData.postalCode || '00000',
            country: addressData.country || 'Côte d’Ivoire',
            isDefault: true,
          },
        });
      }

      // Guarded updates and a serializable transaction prevent overselling.
      for (const item of [...quote.items].sort((a, b) => a.productId - b.productId)) {
        await Inventory.reserve(tx, item.productId, item.quantity);
      }

      // C. Réservation de la promotion
      if (quote.appliedPromotion) {
        const promo = await tx.promotion.findUnique({ where: { id: quote.appliedPromotion.id } });
        if (promo.maxUses && promo.usedCount >= promo.maxUses) {
          throw new Error('La promotion vient d’atteindre sa limite d’utilisation');
        }
        await tx.promotion.update({
          where: { id: quote.appliedPromotion.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      // D. Création de la commande avec snapshots immuables
      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          userId: reqUser?.userId || null,
          status: 'PENDING',
          currency: quote.currency,
          exchangeRate: quote.exchangeRate,
          subtotalAmount: quote.subtotalAmount,
          shippingCost: quote.shippingCost,
          taxAmount: quote.taxAmount,
          discountAmount: quote.discountAmount,
          totalAmount: quote.totalAmount,
          promotionCode: quote.appliedPromotion?.code || null,
          idempotencyKey: idempotencyKey || null,
          checkoutSecretHash: !reqUser?.userId && checkoutSecret ? crypto.createHash('sha256').update(checkoutSecret).digest('hex') : null,
          notes: notes || null,
          customerSnapshot: {
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            email: normalizedEmail,
            phone: customerData.phone || null,
          },
          billingAddress: addressData,
          shippingAddress: addressData,
          items: {
            create: quote.items.map((it) => ({
              productId: it.productId,
              sellerId: it.sellerId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
              commissionRate: it.commissionRate,
              commissionAmount: it.commissionAmount,
              sellerEarnings: it.sellerEarnings,
              sku: it.sku,
              productSnapshot: {
                name: it.name,
                image: it.image,
                sku: it.sku,
              },
              selectedVariant: it.selectedVariant || null,
            })),
          },
          payment: {
            create: {
              amount: quote.totalAmount,
              method: normalizedMethod,
              status: 'PENDING',
            },
          },
          shipping: {
            create: {
              method: quote.shippingOption.method || 'STANDARD',
              status: 'PENDING',
            },
          },
          ...(quote.appliedPromotion && {
            promotionRedemptions: {
              create: {
                promotionId: quote.appliedPromotion.id,
                customerId: customer.id,
                discountApplied: quote.appliedPromotion.discountAmount,
              },
            },
          }),
        },
        include: {
          items: true,
          payment: true,
          shipping: true,
        },
      });

      // E. Journal d'audit de création
      await tx.auditLog.create({
        data: {
          userId: reqUser?.userId || null,
          action: 'ORDER_CREATED',
          entity: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            itemsCount: order.items.length,
          },
          ipAddress: ipAddress || null,
        },
      });

      return { order, isDuplicate: false };
    });

    return result;
  }

  /**
   * Transition d'état de commande selon machine d'état (MM-BE-033)
   */
  static async transitionOrderStatus(orderId, nextStatus, options = {}, existingTx) {
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, payment: true } });
      if (!order) throw httpError('Commande introuvable', 404);
      if (order.status === nextStatus) return order;
      if (!(ALLOWED_ORDER_TRANSITIONS[order.status] || []).includes(nextStatus)) throw httpError(`Transition de statut interdite de ${order.status} vers ${nextStatus}`);
      if (nextStatus === 'REFUNDED' && !options.refundConfirmed) throw httpError('Le prestataire doit confirmer le remboursement');
      if (nextStatus === 'CONFIRMED' && order.payment?.status !== 'COMPLETED' && !['CASH_ON_DELIVERY', 'BANK_TRANSFER'].includes(order.payment?.method)) throw httpError('Paiement non confirme');
      const sortedItems = [...order.items].sort((a, b) => a.productId - b.productId);
      if (nextStatus === 'CANCELLED') {
        if (order.items.some((i) => i.stockCommittedAt)) throw httpError('Des articles sont deja expedies : demander un retour');
        for (const item of sortedItems) await Inventory.release(tx, item);
        if (order.promotionCode) {
          await tx.promotion.updateMany({ where: { code: order.promotionCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
        }
        if (order.payment?.status === 'COMPLETED') {
          await tx.refund.upsert({ where: { orderId }, create: {
            orderId, gateway: order.payment.gateway || 'manual', transactionId: order.payment.transactionId,
            amount: order.totalAmount, currency: 'XOF', reason: options.reason || 'Annulation', status: 'REQUESTED',
          }, update: {} });
        } else if (['PENDING', 'PROCESSING'].includes(order.payment?.status)) {
          await tx.payment.update({ where: { id: order.payment.id }, data: { status: 'FAILED' } });
        }
      }
      if (nextStatus === 'SHIPPED') for (const item of sortedItems) await Inventory.ship(tx, item);
      if (nextStatus === 'REFUNDED' && options.restock) for (const item of sortedItems) await Inventory.restock(tx, item);
      await tx.orderItem.updateMany({ where: { orderId }, data: { fulfillmentStatus: nextStatus } });
      const shippingStatus = { PROCESSING: 'PROCESSING', SHIPPED: 'SHIPPED', DELIVERED: 'DELIVERED', REFUNDED: 'RETURNED' }[nextStatus];
      if (shippingStatus) await tx.shipping.updateMany({ where: { orderId }, data: { status: shippingStatus, ...(nextStatus === 'DELIVERED' ? { actualDelivery: new Date() } : {}) } });
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: nextStatus }, include: { items: true, payment: true, shipping: true } });
      const Ledger = require('./ledger.service');
      if (nextStatus === 'DELIVERED' && order.payment?.status === 'COMPLETED') await Ledger.makeOrderFundsAvailable(orderId, tx);
      if (nextStatus === 'REFUNDED') await Ledger.recordOrderRefund(orderId, { reason: options.reason }, tx);
      await tx.auditLog.create({ data: { userId: options.userId || null, action: `ORDER_STATUS_${nextStatus}`, entity: 'Order', entityId: orderId, details: { from: order.status, to: nextStatus, reason: options.reason }, ipAddress: options.ipAddress || null } });
      return updated;
    }, existingTx);
  }

  // A seller may only advance its own lines, never all sellers' fulfillment.
  static async transitionSellerFulfillment(orderId, sellerId, nextStatus, options = {}) {
    if (!['PROCESSING', 'SHIPPED'].includes(nextStatus)) throw httpError('Statut vendeur interdit', 403);
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || !order.items.some((i) => i.sellerId === sellerId)) throw httpError('Commande introuvable', 404);
      if (!['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.status)) throw httpError('Commande non eligible');
      const own = order.items.filter((i) => i.sellerId === sellerId).sort((a, b) => a.productId - b.productId);
      for (const item of own) {
        if (item.fulfillmentStatus === nextStatus) continue;
        const expected = nextStatus === 'PROCESSING' ? 'CONFIRMED' : 'PROCESSING';
        if (item.fulfillmentStatus !== expected) throw httpError('Transition logistique interdite');
        if (nextStatus === 'SHIPPED') await Inventory.ship(tx, item);
        await tx.orderItem.update({ where: { id: item.id }, data: {
          fulfillmentStatus: nextStatus,
          ...(nextStatus === 'SHIPPED' ? { carrier: options.carrier || null, trackingCode: options.trackingCode || null } : {}),
        } });
      }
      const items = await tx.orderItem.findMany({ where: { orderId } });
      const allShipped = items.every((i) => i.fulfillmentStatus === 'SHIPPED');
      const status = allShipped ? 'SHIPPED' : 'PROCESSING';
      await tx.order.update({ where: { id: orderId }, data: { status } });
      await tx.shipping.updateMany({ where: { orderId }, data: { status: allShipped ? 'SHIPPED' : 'PROCESSING' } });
      await tx.auditLog.create({ data: { userId: options.userId || null, action: `SELLER_FULFILLMENT_${nextStatus}`, entity: 'Order', entityId: orderId, details: { sellerId } } });
      return { id: orderId, status, items: items.filter((i) => i.sellerId === sellerId) };
    });
  }

  static async expirePendingOrders(maxAgeMinutes = 60) {
    const orders = await db.order.findMany({ where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - maxAgeMinutes * 60000) }, payment: { is: { method: 'CARD', status: { in: ['PENDING', 'FAILED'] } } } }, select: { id: true } });
    let expiredCount = 0;
    for (const order of orders) {
      await transaction(async (tx) => {
        await lockOrder(tx, order.id);
        const current = await tx.order.findUnique({ where: { id: order.id }, include: { payment: true } });
        if (current?.status === 'PENDING' && ['PENDING', 'FAILED'].includes(current.payment?.status)) {
          await this.transitionOrderStatus(order.id, 'CANCELLED', { reason: 'Commande abandonnee avant initiation du paiement' }, tx);
          expiredCount++;
        }
      });
    }
    return { expiredCount, totalFound: orders.length };
  }
}
module.exports = { OrderService, ALLOWED_ORDER_TRANSITIONS, ALLOWED_PAYMENT_TRANSITIONS, ALLOWED_SHIPPING_TRANSITIONS };
