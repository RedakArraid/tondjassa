const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { requireAuth, requireRole, optionalAuth } = require('./middleware.auth');
const db = require('./db');
const { OrderService } = require('./services/order.service');
const { assertOrderAccess, publicOrder } = require('./services/order-access.service');
const { detectRegion, resolveCountryCode } = require('./utils/region');
const paystackService = require('./services/paystack.service');
const stripeService = require('./services/stripe.service');

// Schémas de validation
const orderUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  notes: z.string().trim().max(2000).optional()
}).strict();

// Schéma de validation pour le checkout public
const checkoutSchema = z.object({
  customer: z.object({
    firstName: z.string().trim().min(1, 'Le prénom est requis').max(100),
    lastName: z.string().trim().min(1, 'Le nom est requis').max(100),
    email: z.string().email('Email invalide'),
    phone: z.string().trim().max(30).optional().nullable()
  }).strict(),
  address: z.object({
    street: z.string().trim().min(1, "L'adresse est requise").max(250),
    city: z.string().trim().min(1, 'La ville est requise').max(100),
    postalCode: z.string().trim().max(20).default('00000'),
    country: z.string().trim().min(2).max(100).default("Côte d'Ivoire")
  }).strict(),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
    selectedVariant: z.record(z.union([z.string().max(200), z.number().finite(), z.boolean()])).refine((value) => Object.keys(value).length <= 20).optional()
  }).strict()).min(1, 'Au moins un article est requis').max(100),
  paymentMethod: z.enum(['cash_on_delivery', 'stripe', 'paystack', 'wave', 'orange_money', 'mtn_momo']),
  shippingMethod: z.enum(['STANDARD', 'EXPRESS', 'PICKUP']).optional(),
  promoCode: z.string().trim().max(50).optional().nullable(),
  idempotencyKey: z.string().uuid(),
  checkoutSecret: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  notes: z.string().trim().max(2000).optional().nullable()
}).strict();

const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  customerId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'totalAmount', 'orderNumber', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();
const statusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  reason: z.string().trim().max(1000).optional(),
}).strict();

// POST checkout public (atomique et idempotent via OrderService - MM-BE-032)
router.post('/checkout', optionalAuth, async (req, res) => {
  try {
    const data = checkoutSchema.parse(req.body);
    if (!req.user && !data.checkoutSecret) return res.status(400).json({ error: 'Secret de commande invite requis' });
    const country = resolveCountryCode(data.address.country);
    const paystackMethods = new Set(['paystack', 'wave', 'orange_money', 'mtn_momo']);
    const paymentAvailable = (
      (country === 'CI' && data.paymentMethod === 'cash_on_delivery')
      || (country === 'CI' && paystackMethods.has(data.paymentMethod) && paystackService.isConfigured())
      || (detectRegion(country) === 'europe' && data.paymentMethod === 'stripe' && stripeService.isConfigured())
    );
    if (!paymentAvailable) return res.status(422).json({ error: 'Moyen de paiement indisponible pour ce pays' });
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const { order, isDuplicate } = await OrderService.checkoutOrder({
      customerData: data.customer,
      addressData: data.address,
      items: data.items,
      shippingMethod: data.shippingMethod,
      promoCode: data.promoCode,
      paymentMethod: data.paymentMethod,
      idempotencyKey: data.idempotencyKey,
      checkoutSecret: data.checkoutSecret,
      notes: data.notes,
      reqUser: req.user,
      ipAddress,
    });

    const emailService = require('./services/email.service');
    const fullCustomer = await db.customer.findUnique({ where: { id: order.customerId } });
    const fullOrder = await db.order.findUnique({
      where: { id: order.id }, include: { items: { include: { product: { select: { name: true } } } } },
    });
    if (fullCustomer && fullOrder) {
      await emailService.sendOrderConfirmation(fullOrder.customerSnapshot || fullCustomer, fullOrder);
      await emailService.sendNewOrderNotification(fullOrder, fullCustomer);
    }

    res.status(isDuplicate ? 200 : 201).json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      currency: order.currency,
      isDuplicate,
      order: publicOrder(order),
      message: isDuplicate ? 'Commande déjà enregistrée' : 'Commande créée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du checkout:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Données invalides', details: error.errors });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || 'Erreur lors de la commande' });
  }
});

// GET consultation publique d'une commande par numéro de commande ou identifiant (MM-FE-031)
router.get('/reference/:orderNumber', optionalAuth, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await db.order.findFirst({
      where: {
        OR: [
          { orderNumber },
          { id: orderNumber }
        ]
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true,
              }
            }
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            transactionId: true,
            createdAt: true
          }
        },
        shipping: {
          select: {
            id: true,
            method: true,
            carrier: true,
            status: true,
            trackingCode: true,
            estimatedDelivery: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    assertOrderAccess(req, order);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ order: publicOrder(order) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erreur serveur' });
  }
});

// GET toutes les commandes avec pagination et filtres
router.get('/', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { page, limit, status, customerId, startDate, endDate, sortBy, sortOrder } = listOrdersSchema.parse(req.query);
    const skip = (page - 1) * limit;
    
    // Construire les filtres
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Construire le tri
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          customer: true,
          user: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: true
            }
          },
          payment: true,
          shipping: true
        },
        orderBy,
        skip,
        take: limit
      }),
      db.order.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Filtres invalides', details: error.errors });
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET commande par ID
router.get('/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const order = await db.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          include: {
            address: true
          }
        },
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: true
          }
        },
        payment: true,
        shipping: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json(order);
  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Orders, including operator-assisted orders, must use the priced checkout path.
router.post('/', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  res.status(409).json({ error: 'Utilisez le parcours checkout avec prix serveur; la creation manuelle non tarifee est desactivee.' });
});

// PATCH /:id/status - Transition d'état sécurisée via machine d'état (MM-BE-033)
router.patch('/:id/status', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { status, reason } = statusUpdateSchema.parse(req.body);

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const updatedOrder = await OrderService.transitionOrderStatus(req.params.id, status, {
      userId: req.user?.userId,
      reason,
      ipAddress,
    });

    const notificationOrder = await db.order.findUnique({ where: { id: updatedOrder.id }, include: { customer: true, shipping: true } });
    if (notificationOrder?.customer) await require('./services/email.service').sendOrderStatusUpdate(notificationOrder.customer, notificationOrder, status);

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Statut invalide', details: error.errors });
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Erreur transition statut commande:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erreur serveur' });
  }
});

// PUT mettre à jour une commande (sécurisé avec machine d'état - MM-BE-033)
router.put('/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = orderUpdateSchema.parse(req.body);
    let order;

    if (data.status) {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      order = await OrderService.transitionOrderStatus(req.params.id, data.status, {
        userId: req.user?.userId,
        reason: data.notes,
        ipAddress,
      });
    }

    if (data.notes) {
      order = await db.order.update({
        where: { id: req.params.id },
        data: { notes: data.notes },
        include: {
          customer: true,
          items: { include: { product: true } },
          payment: true,
          shipping: true
        }
      });
    }

    if (!order) {
      order = await db.order.findUnique({
        where: { id: req.params.id },
        include: {
          customer: true,
          items: { include: { product: true } },
          payment: true,
          shipping: true
        }
      });
    }

    if (data.status) {
      const notificationOrder = await db.order.findUnique({ where: { id: req.params.id }, include: { customer: true, shipping: true } });
      if (notificationOrder?.customer) await require('./services/email.service').sendOrderStatusUpdate(notificationOrder.customer, notificationOrder, data.status);
    }

    res.json(order);
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Erreur lors de la mise à jour de la commande:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Données invalides', details: error.errors });
    }
    res.status(error.statusCode || 500).json({ error: error.message || 'Erreur serveur' });
  }
});

// GET statistiques des commandes
router.get('/stats/overview', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [
      totalOrders,
      totalRevenue,
      ordersByStatus,
      recentOrders
    ] = await Promise.all([
      db.order.count({ where }),
      db.order.aggregate({
        where: { ...where, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true }
      }),
      db.order.groupBy({
        by: ['status'],
        where,
        _count: { id: true }
      }),
      db.order.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      ordersByStatus,
      recentOrders
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
