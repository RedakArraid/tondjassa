const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('./db');

const { requireCustomerAuth } = require('./middleware.auth');
const sessionService = require('./services/session.service');
const verification = require('./services/verification.service');
const { OrderService } = require('./services/order.service');

router.post('/register', async (req, res) => {
  try { res.status(202).json(await verification.registerCustomer(req.body)); }
  catch (error) { res.status(error.statusCode || 400).json({ error: error.name === 'ZodError' ? 'Nom, email ou mot de passe invalide (12 caracteres minimum)' : error.message }); }
});
router.post('/login', async (req, res) => {
  try {
    const data = z.object({ email: verification.emailRule, password: z.string().min(1).max(72) }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: data.email }, include: { customer: true, seller: true } });
    if (!user || !await bcrypt.compare(data.password, user.password)) return res.status(401).json({ error: 'Identifiants invalides' });
    if (user.role !== 'customer') return res.status(403).json({ error: 'Ce compte n est pas un compte client. Utilisez /admin/login.', redirectTo: '/admin/login' });
    if (!user.emailVerifiedAt) return res.status(403).json({ error: 'Verifiez votre email depuis /compte/verifier-email', verificationRequired: true });
    if (!user.customer || user.customer.status === 'deleted') return res.status(403).json({ error: 'Compte client indisponible' });
    const tokens = await sessionService.issueSession(user, req, res);
    const { id, firstName, lastName, email, phone, loyaltyPoints, totalSpent } = user.customer;
    res.json({ ...tokens, customer: { id, firstName, lastName, email, phone, loyaltyPoints, totalSpent } });
  } catch (error) { res.status(error.statusCode || 400).json({ error: 'Connexion impossible' }); }
});

// GET /me
router.get('/me', requireCustomerAuth, async (req, res) => {
  try {
    const customer = await db.customer.findUnique({ where: { id: req.customerId }, include: { address: true } });
    if (!customer) return res.status(404).json({ error: 'Client non trouvé' });
    res.json({ customer });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// PUT /profile - Mise à jour du profil client
router.put('/profile', requireCustomerAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone } = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional().nullable(),
    }).parse(req.body);

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;

    const customer = await db.customer.update({
      where: { id: req.customerId },
      data: updateData,
      include: { address: true },
    });

    if (req.userId && (firstName || lastName)) {
      const fullName = `${customer.firstName} ${customer.lastName}`.trim();
      await db.user.update({
        where: { id: req.userId },
        data: { name: fullName },
      });
    }

    res.json({ success: true, customer });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'Données invalides', details: err.errors });
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// PUT /password - Changement de mot de passe sécurisé
router.put('/password', requireCustomerAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: verification.passwordRule,
    }).parse(req.body);

    let user = null;
    if (req.userId) {
      user = await db.user.findUnique({ where: { id: req.userId } });
    }
    if (!user) {
      user = await db.user.findUnique({ where: { email: req.customerEmail } });
    }
    if (!user) {
      return res.status(404).json({ error: 'Compte utilisateur introuvable' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { password: hash },
    });

    // Révoquer les sessions actives
    await db.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true, message: 'Mot de passe mis à jour avec succès' });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'Données invalides', details: err.errors });
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// GET /address - Récupérer l'adresse
router.get('/address', requireCustomerAuth, async (req, res) => {
  try {
    const address = await db.address.findUnique({ where: { customerId: req.customerId } });
    res.json({ address });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /address - Enregistrer ou mettre à jour l'adresse
router.post('/address', requireCustomerAuth, async (req, res) => {
  try {
    const data = z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      postalCode: z.string().default(''),
      country: z.string().min(1),
      isDefault: z.boolean().default(true),
    }).parse(req.body);

    const address = await db.address.upsert({
      where: { customerId: req.customerId },
      create: { ...data, customerId: req.customerId },
      update: data,
    });

    res.json({ success: true, address });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'Données invalides', details: err.errors });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /address - Supprimer l'adresse
router.delete('/address', requireCustomerAuth, async (req, res) => {
  try {
    await db.address.deleteMany({ where: { customerId: req.customerId } });
    res.json({ success: true, message: 'Adresse supprimée' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /orders
router.get('/orders', requireCustomerAuth, async (req, res) => {
  try {
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: { customerId: req.customerId },
        include: {
          items: { include: { product: { select: { id: true, name: true, image: true, price: true } } } },
          payment: true, shipping: true
        },
        orderBy: { createdAt: 'desc' }, skip, take: limitNum
      }),
      db.order.count({ where: { customerId: req.customerId } })
    ]);
    res.json({ orders, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// GET /orders/:id
router.get('/orders/:id', requireCustomerAuth, async (req, res) => {
  try {
    const order = await db.order.findFirst({
      where: { id: req.params.id, customerId: req.customerId },
      include: {
        customer: { include: { address: true } },
        items: { include: { product: true, seller: { select: { id: true, storeName: true, slug: true } } } },
        payment: true, shipping: true
      }
    });
    if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
    res.json(order);
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// All cancellation paths share the same inventory/payment transaction.
router.post('/orders/:id/cancel', requireCustomerAuth, async (req, res) => {
  try {
    const order = await db.order.findFirst({ where: { id: req.params.id, customerId: req.customerId }, select: { id: true } });
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    const updated = await OrderService.transitionOrderStatus(order.id, 'CANCELLED', { userId: req.userId, reason: String(req.body?.reason || 'Annulation client').slice(0, 500) });
    res.json({ success: true, status: updated.status, message: 'Commande annulee. Tout paiement recu fera l objet d un remboursement suivi separement.' });
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.message }); }
});

// POST /orders/:id/return-request
router.post('/orders/:id/return-request', requireCustomerAuth, async (req, res) => {
  try {
    const order = await db.order.findFirst({
      where: { id: req.params.id, customerId: req.customerId },
    });
    if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
    if (!['DELIVERED'].includes(order.status)) {
      return res.status(400).json({ error: 'La commande doit être livrée pour demander un retour' });
    }
    const existing = await db.returnRequest.findFirst({
      where: { orderId: order.id },
    });
    if (existing) return res.status(409).json({ error: 'Une demande de retour existe déjà pour cette commande' });

    const { reason, description } = z.object({
      reason:      z.string().min(1),
      description: z.string().optional(),
    }).parse(req.body);

    const returnReq = await db.returnRequest.create({
      data: { orderId: order.id, customerId: req.customerId, reason, description },
    });
    res.status(201).json(returnReq);
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'Données invalides', details: err.errors });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /returns - Demandes de retours du client
router.get('/returns', requireCustomerAuth, async (req, res) => {
  try {
    const returns = await db.returnRequest.findMany({
      where: { customerId: req.customerId },
      include: {
        order: {
          select: {
            id: true,
            totalAmount: true,
            createdAt: true,
            status: true,
            items: {
              include: {
                product: { select: { id: true, name: true, image: true, price: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ returns });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /orders/:id/invoice — returns full order data for invoice rendering
router.get('/orders/:id/invoice', requireCustomerAuth, async (req, res) => {
  try {
    const order = await db.order.findFirst({
      where: { id: req.params.id, customerId: req.customerId },
      include: {
        customer: { include: { address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, image: true, price: true } },
            seller:  { select: { id: true, storeName: true } },
          },
        },
        payment:  true,
        shipping: true,
      },
    });
    if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
    res.json(order);
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

// DELETE /account - Suppression et anonymisation RGPD du compte
router.delete('/account', requireCustomerAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression' });
    }

    let user = null;
    if (req.userId) {
      user = await db.user.findUnique({ where: { id: req.userId } });
    }
    if (!user) {
      user = await db.user.findUnique({ where: { email: req.customerEmail } });
    }
    if (!user) {
      return res.status(404).json({ error: 'Compte utilisateur introuvable' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Mot de passe incorrect' });
    }

    const anonSuffix = Math.random().toString(36).substring(2, 9);
    const anonEmail = `anonymized_${req.customerId.substring(0, 8)}_${anonSuffix}@deleted.mandemarket.com`;

    await db.$transaction(async (tx) => {
      // 1. Anonymiser l'adresse
      await tx.address.deleteMany({ where: { customerId: req.customerId } });

      // 2. Anonymiser le profil client
      await tx.customer.update({
        where: { id: req.customerId },
        data: {
          firstName: 'Anonyme',
          lastName: 'Client',
          phone: null,
          email: anonEmail,
          status: 'deleted',
        },
      });

      // 3. Mettre à jour l'utilisateur et révoquer sessions
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: anonEmail,
          name: 'Compte Supprimé',
          role: 'user',
        },
      });

      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    res.json({ success: true, message: 'Votre compte a été supprimé et vos données anonymisées.' });
  } catch (err) {
    console.error('Erreur suppression compte:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
  }
});

// POST /wishlist/products - récupère les détails de produits en wishlist (IDs envoyés depuis localStorage)
router.post('/wishlist/products', async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) return res.json([]);
    if (productIds.length > 100) return res.status(400).json({ error: 'Trop de produits demandés' });
    const ids = [...new Set(productIds.map(Number).filter(Number.isSafeInteger))];
    const products = await db.product.findMany({
      where: {
        id: { in: ids },
        status: 'active',
        category: { is: { status: 'active' } },
        OR: [{ sellerId: null }, { seller: { is: { status: 'approved' } } }],
      },
      include: { category: { select: { id: true, name: true, slug: true } } }
    });
    res.json(products);
  } catch { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
module.exports.requireCustomerAuth = requireCustomerAuth;
