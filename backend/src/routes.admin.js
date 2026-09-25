const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { requireAuth, requireRole } = require('./middleware.auth');
const ledgerService = require('./services/ledger.service');

// Middleware strict : Seuls admin et manager ont accès à /api/admin
router.use(requireAuth, requireRole(['admin', 'manager']));

// ==========================================
// MM-BE-070 : GESTION DES UTILISATEURS
// ==========================================

// GET /api/admin/users - Lister, rechercher et paginer
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (role && ['user', 'customer', 'seller', 'manager', 'admin'].includes(role)) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { name: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          seller: { select: { id: true, storeName: true, slug: true, status: true } },
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          _count: {
            select: {
              orders: true,
              sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      db.user.count({ where }),
    ]);

    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name || (u.customer ? `${u.customer.firstName} ${u.customer.lastName}` : (u.seller ? u.seller.storeName : 'Utilisateur')),
      role: u.role,
      createdAt: u.createdAt,
      seller: u.seller,
      customer: u.customer,
      activeSessions: u._count.sessions,
      totalOrders: u._count.orders,
      isSuspended: u.role === 'user' && u.name?.includes('[SUSPENDU]'),
    }));

    res.json({
      users: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/admin/users:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des utilisateurs' });
  }
});

// POST /api/admin/users - Créer un utilisateur privilégié
router.post('/users', async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, mot de passe et rôle requis' });
    }

    // Seul un admin peut créer un autre admin ou manager
    if (['admin', 'manager'].includes(role) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Seul un administrateur peut créer des comptes de gestion' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà' });
    }

    require('./services/verification.service').passwordRule.parse(password);
    require('./services/verification.service').emailRule.parse(cleanEmail);
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: {
        email: cleanEmail,
        name: name ? name.trim() : null,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'ADMIN_USER_CREATED',
        entity: 'User',
        entityId: user.id,
        details: { email: user.email, role: user.role, createdBy: req.user.userId },
      },
    });

    await require('./services/verification.service').sendVerification(user);
    res.status(201).json({ ...user, verificationRequired: true });
  } catch (error) {
    console.error('Erreur POST /api/admin/users:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l’utilisateur' });
  }
});

// PUT /api/admin/users/:id/role - Modifier le rôle d'un utilisateur
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'customer', 'seller', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    // Seul un admin peut modifier le rôle vers ou depuis admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Action réservée aux administrateurs' });
    }

    const targetUser = await db.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Empêcher de rétrograder le dernier admin
    if (targetUser.role === 'admin' && role !== 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Impossible de rétrograder le seul administrateur actif' });
      }
    }

    const updated = await db.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    await db.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'ADMIN_USER_ROLE_UPDATED',
        entity: 'User',
        entityId: updated.id,
        details: { previousRole: targetUser.role, newRole: role },
      },
    });

    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Erreur rôle utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle' });
  }
});

// POST /api/admin/users/:id/revoke-sessions - Révoquer toutes les sessions actives
router.post('/users/:id/revoke-sessions', async (req, res) => {
  try {
    await db.session.updateMany({
      where: { userId: req.params.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'ADMIN_USER_SESSIONS_REVOKED',
        entity: 'User',
        entityId: req.params.id,
        details: { revokedBy: req.user.userId },
      },
    });

    res.json({ success: true, message: 'Sessions révoquées avec succès' });
  } catch (error) {
    console.error('Erreur révocation sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la révocation des sessions' });
  }
});

// GET /api/admin/users/:id/audit - Historique d'audit d'un utilisateur
router.get('/users/:id/audit', async (req, res) => {
  try {
    const logs = await db.auditLog.findMany({
      where: {
        OR: [
          { userId: req.params.id },
          { entityId: req.params.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des logs d’audit' });
  }
});

// GET /api/admin/audit-logs - Journal d'audit global système
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, entity, action } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      db.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/admin/audit-logs:', error);
    res.status(500).json({ error: 'Erreur récupération journal d’audit' });
  }
});

// ==========================================
// MM-BE-071 : MODÉRATION DES AVIS CLIENTS
// ==========================================

// GET /api/admin/reviews - Tous les avis pour modération
router.get('/reviews', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const where = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              image: true,
              seller: { select: { id: true, storeName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      db.review.count({ where }),
    ]);

    res.json({
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/admin/reviews:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des avis' });
  }
});

// PUT /api/admin/reviews/:id/moderate - Approuver ou rejeter un avis
router.put('/reviews/:id/moderate', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Statut de modération invalide' });
    }

    const review = await db.review.findUnique({
      where: { id: req.params.id },
      include: { product: true },
    });

    if (!review) {
      return res.status(404).json({ error: 'Avis introuvable' });
    }

    const updated = await db.review.update({
      where: { id: req.params.id },
      data: { status },
    });

    // Recalculer la note moyenne du produit et du vendeur si l'avis est approuvé ou retiré
    const approvedProductReviews = await db.review.findMany({
      where: { productId: review.productId, status: 'approved' },
      select: { rating: true },
    });

    if (review.product.sellerId) {
      const sellerReviews = await db.review.findMany({
        where: { product: { sellerId: review.product.sellerId }, status: 'approved' },
        select: { rating: true },
      });
      const avgSeller = sellerReviews.length > 0
        ? sellerReviews.reduce((sum, r) => sum + r.rating, 0) / sellerReviews.length
        : 0;

      await db.seller.update({
        where: { id: review.product.sellerId },
        data: {
          rating: parseFloat(avgSeller.toFixed(2)),
          reviewCount: sellerReviews.length,
        },
      });
    }

    await db.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'ADMIN_REVIEW_MODERATED',
        entity: 'Review',
        entityId: review.id,
        details: { previousStatus: review.status, newStatus: status },
      },
    });

    res.json({ success: true, review: updated });
  } catch (error) {
    console.error('Erreur modération avis:', error);
    res.status(500).json({ error: 'Erreur lors de la modération' });
  }
});

// ==========================================
// MM-BE-072 : RETOURS ET REMBOURSEMENTS
// ==========================================

// GET /api/admin/returns - Liste des demandes de retour
router.get('/returns', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const where = {};
    if (status && ['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      where.status = status;
    }

    const [returns, total] = await Promise.all([
      db.returnRequest.findMany({
        where,
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
          order: {
            include: {
              items: {
                include: {
                  product: { select: { id: true, name: true, sku: true, stock: true } },
                  seller: { select: { id: true, storeName: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      db.returnRequest.count({ where }),
    ]);

    res.json({
      returns,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/admin/returns:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des retours' });
  }
});

// POST /api/admin/returns/:id/approve - Approuver un retour
router.post('/returns/:id/approve', async (req, res) => {
  try {
    const ret = await db.returnRequest.findUnique({ where: { id: req.params.id } });
    if (!ret) return res.status(404).json({ error: 'Demande de retour introuvable' });

    const updated = await db.returnRequest.update({
      where: { id: req.params.id },
      data: { status: 'approved' },
    });

    await db.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'ADMIN_RETURN_APPROVED',
        entity: 'ReturnRequest',
        entityId: ret.id,
      },
    });

    res.json({ success: true, returnRequest: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l’approbation du retour' });
  }
});

// POST /api/admin/returns/:id/reject - Rejeter un retour
router.post('/returns/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const updated = await db.returnRequest.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        description: reason ? `[Motif de refus]: ${reason}` : undefined,
      },
    });

    await db.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'ADMIN_RETURN_REJECTED',
        entity: 'ReturnRequest',
        entityId: req.params.id,
        details: { reason },
      },
    });

    res.json({ success: true, returnRequest: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du rejet du retour' });
  }
});

// A returned item is not considered reimbursed until a provider confirms the refund.
const RefundService = require('./services/refund.service');
router.post('/returns/:id/process-refund', requireRole('admin'), async (req, res) => {
  try {
    const ret = await db.returnRequest.findUnique({ where: { id: req.params.id } });
    if (!ret) return res.status(404).json({ error: 'Retour introuvable' });
    if (!['approved', 'completed'].includes(ret.status)) return res.status(409).json({ error: 'Approuvez le retour avant remboursement' });
    const refund = await RefundService.request(ret.orderId, { reason: `Retour ${ret.id}`, userId: req.user.userId,
      restock: req.body?.itemsReceived === true });
    const result = await RefundService.process(refund.id);
    res.status(result.status === 'COMPLETED' ? 200 : 202).json({ success: true, refund: result,
      message: result.status === 'COMPLETED' ? 'Remboursement confirme' : 'Remboursement non encore confirme: suivi requis' });
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.message }); }
});
router.get('/refunds', requireRole('admin'), async (_req, res) => {
  try { res.json({ refunds: await db.refund.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }) }); }
  catch { res.status(503).json({ error: 'Service indisponible' }); }
});
router.post('/refunds/:id/reconcile', requireRole('admin'), async (req, res) => {
  try { res.json({ refund: await RefundService.process(req.params.id) }); }
  catch (error) { res.status(error.statusCode || 500).json({ error: error.message }); }
});
router.post('/refunds/:id/confirm-manual', requireRole('admin'), async (req, res) => {
  try {
    const refund = await db.refund.findUnique({ where: { id: req.params.id } });
    if (!refund || ['stripe', 'paystack'].includes(refund.gateway)) return res.status(409).json({ error: 'Ce remboursement necessite une verification par API' });
    if (req.body?.confirmed !== true || typeof req.body.reference !== 'string' || req.body.reference.trim().length < 6 ||
      req.body.reference.length > 200 || req.body.amount !== refund.amount || req.body.currency !== refund.currency) {
      return res.status(400).json({ error: 'Confirmez le transfert effectue avec sa reference, son montant exact et sa devise' });
    }
    res.json({ refund: await RefundService.finalize(refund.id, req.body.reference.trim(), req.user.userId) });
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.message }); }
});
router.post('/orders/:id/confirm-payment', requireRole('admin'), async (req, res) => {
  try {
    if (req.body?.confirmed !== true) return res.status(400).json({ error: 'Confirmez la reception effective des fonds' });
    const result = await require('./services/payment.service').recordManualPayment(req.params.id, {
      amount: req.body.amount, currency: req.body.currency, reference: req.body.reference, userId: req.user.userId });
    res.json(result);
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.message }); }
});
module.exports = router;
