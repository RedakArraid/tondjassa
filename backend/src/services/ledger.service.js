const db = require('../db');
const { transaction, lockOrder, lockSeller, httpError } = require('./transaction');

// Payouts are deducted via SellerPayout only; do not count their negative ledger
// entries a second time. Refunds and adjustments DO affect earned funds.
const earnedWhere = { status: { in: ['AVAILABLE', 'CLEARED'] }, type: { in: ['SALE_AVAILABLE', 'REFUND', 'ADJUSTMENT'] } };
class LedgerService {
  static async recordOrderPayment(orderId, existingTx) {
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw httpError('Commande introuvable', 404);
      const ids = [...new Set(order.items.map((i) => i.sellerId).filter(Boolean))].sort();
      for (const sellerId of ids) {
        await lockSeller(tx, sellerId);
        const items = order.items.filter((i) => i.sellerId === sellerId);
        const existing = await tx.sellerLedgerEntry.findFirst({ where: { sellerId, orderId, type: { in: ['SALE_PENDING', 'SALE_AVAILABLE'] } } });
        if (existing) continue;
        const amount = items.reduce((s, i) => s + i.totalPrice, 0);
        const feeAmount = items.reduce((s, i) => s + i.commissionAmount, 0);
        const netAmount = items.reduce((s, i) => s + i.sellerEarnings, 0);
        await tx.sellerLedgerEntry.create({ data: {
          sellerId, orderId, type: 'SALE_PENDING', status: 'PENDING', amount, feeAmount, netAmount,
          description: `Vente #${order.orderNumber}`,
        } });
      }
    }, existingTx);
  }
  static async makeOrderFundsAvailable(orderId, existingTx) {
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const entries = await tx.sellerLedgerEntry.findMany({ where: { orderId, type: 'SALE_PENDING', status: 'PENDING' }, orderBy: { sellerId: 'asc' } });
      for (const entry of entries) {
        await lockSeller(tx, entry.sellerId);
        await tx.sellerLedgerEntry.update({ where: { id: entry.id }, data: { type: 'SALE_AVAILABLE', status: 'AVAILABLE', availableAt: new Date() } });
      }
    }, existingTx);
  }
  static async recordOrderRefund(orderId, { reason } = {}, existingTx) {
    return transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const entries = await tx.sellerLedgerEntry.findMany({ where: { orderId, type: { in: ['SALE_PENDING', 'SALE_AVAILABLE'] } }, orderBy: { sellerId: 'asc' } });
      for (const entry of entries) {
        await lockSeller(tx, entry.sellerId);
        if (entry.status === 'PENDING') {
          await tx.sellerLedgerEntry.update({ where: { id: entry.id }, data: { status: 'CANCELLED', description: reason || 'Remboursement' } });
        } else if (entry.status === 'AVAILABLE') {
          const existing = await tx.sellerLedgerEntry.findFirst({ where: { orderId, sellerId: entry.sellerId, type: 'REFUND' } });
          if (!existing) await tx.sellerLedgerEntry.create({ data: {
            sellerId: entry.sellerId, orderId, type: 'REFUND', amount: -entry.amount,
            feeAmount: -entry.feeAmount, netAmount: -entry.netAmount, status: 'CLEARED', description: reason || 'Remboursement',
          } });
        }
      }
    }, existingTx);
  }
  static async getSellerBalances(sellerId, tx = db) {
    const pendingAgg = await tx.sellerLedgerEntry.aggregate({ where: { sellerId, type: 'SALE_PENDING', status: 'PENDING' }, _sum: { netAmount: true } });
    const earnedAgg = await tx.sellerLedgerEntry.aggregate({ where: { sellerId, ...earnedWhere }, _sum: { netAmount: true } });
    const reservedAgg = await tx.sellerPayout.aggregate({ where: { sellerId, status: { in: ['pending', 'processing'] } }, _sum: { amount: true } });
    const paidAgg = await tx.sellerPayout.aggregate({ where: { sellerId, status: 'completed' }, _sum: { amount: true } });
    const pending = pendingAgg._sum.netAmount || 0;
    const earned = earnedAgg._sum.netAmount || 0;
    const reserved = reservedAgg._sum.amount || 0;
    const paid = paidAgg._sum.amount || 0;
    const net = earned - reserved - paid;
    return { pending, available: Math.max(0, net), debt: Math.max(0, -net), reserved, paid, totalEarnings: pending + earned, currency: 'XOF' };
  }
  static async requestPayout({ sellerId, amount, method, metadata, userId, ipAddress }) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw httpError('Le montant du retrait doit etre un entier positif', 400);
    if (amount < 500000) throw httpError('Le montant minimum de retrait est de 5000 FCFA', 400);
    return transaction(async (tx) => {
      await lockSeller(tx, sellerId);
      const dueRefund = await tx.refund.findFirst({ where: { status: { not: 'COMPLETED' },
        order: { items: { some: { sellerId } } } }, select: { id: true } });
      if (dueRefund) throw httpError('Un remboursement doit etre rapproche avant un nouveau retrait');
      const earned = await tx.sellerLedgerEntry.aggregate({ where: { sellerId, ...earnedWhere }, _sum: { netAmount: true } });
      const committed = await tx.sellerPayout.aggregate({ where: { sellerId, status: { in: ['pending', 'processing', 'completed'] } }, _sum: { amount: true } });
      if (amount > (earned._sum.netAmount || 0) - (committed._sum.amount || 0)) throw httpError('Solde disponible insuffisant', 400);
      const payout = await tx.sellerPayout.create({ data: { sellerId, amount, method: method || 'bank_transfer', metadata: metadata || {}, status: 'pending' } });
      await tx.sellerLedgerEntry.create({ data: { sellerId, payoutId: payout.id, type: 'PAYOUT_RESERVED', amount: -amount, feeAmount: 0, netAmount: -amount, status: 'LOCKED', description: 'Retrait reserve' } });
      await tx.auditLog.create({ data: { userId: userId || null, action: 'PAYOUT_REQUESTED', entity: 'SellerPayout', entityId: payout.id, details: { sellerId, amount, method }, ipAddress: ipAddress || null } });
      return payout;
    });
  }
  static async updatePayoutStatus(payoutId, nextStatus, { reference, reason, adminUserId, ipAddress } = {}) {
    const allowed = { pending: ['processing', 'cancelled', 'failed'], processing: ['completed', 'failed'], completed: [], failed: [], cancelled: [] };
    return transaction(async (tx) => {
      const initial = await tx.sellerPayout.findUnique({ where: { id: payoutId } });
      if (!initial) throw httpError('Demande de retrait introuvable', 404);
      await lockSeller(tx, initial.sellerId);
      const payout = await tx.sellerPayout.findUnique({ where: { id: payoutId } });
      if (payout.status === nextStatus) return payout;
      if (!allowed[payout.status]?.includes(nextStatus)) throw httpError(`Transition impossible de ${payout.status} vers ${nextStatus}`);
      if (nextStatus === 'completed' && (typeof reference !== 'string' || !reference.trim())) throw httpError('Reference du versement effectif obligatoire', 400);
      if (nextStatus === 'completed') {
        await tx.sellerLedgerEntry.updateMany({ where: { payoutId }, data: { type: 'PAYOUT_COMPLETED', status: 'CLEARED', description: `Versement ${reference.trim()}` } });
      } else if (['failed', 'cancelled'].includes(nextStatus)) {
        await tx.sellerLedgerEntry.updateMany({ where: { payoutId }, data: { type: 'PAYOUT_RELEASED', status: 'CANCELLED', description: reason || nextStatus } });
      }
      const updated = await tx.sellerPayout.update({ where: { id: payoutId }, data: { status: nextStatus, reference: reference?.trim() || payout.reference, paidAt: nextStatus === 'completed' ? new Date() : payout.paidAt } });
      await tx.auditLog.create({ data: { userId: adminUserId || null, action: `PAYOUT_STATUS_${nextStatus.toUpperCase()}`, entity: 'SellerPayout', entityId: payoutId, details: { from: payout.status, to: nextStatus, reference, reason }, ipAddress: ipAddress || null } });
      return updated;
    });
  }
  static async processPayout(payoutId, opts = {}) { return this.updatePayoutStatus(payoutId, 'completed', opts); }
  static async failPayout(payoutId, opts = {}) { return this.updatePayoutStatus(payoutId, 'failed', opts); }
}
module.exports = LedgerService;
