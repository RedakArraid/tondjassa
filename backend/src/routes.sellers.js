const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { requireAuth, requireAdmin, requireRole, requireSeller } = require('./middleware.auth');
const db = require('./db');
const ReviewService = require('./services/review.service');
const crypto = require('node:crypto');
const { permissionsForRole } = require('./services/seller-access.service');

// Slugify helper
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Schémas validation
const registerSellerSchema = z.object({
  storeName: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).optional(),
  description: z.string().max(500).optional(),
  logo: z.string().url().optional()
});

const updateSellerSchema = z.object({
  storeName: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  logo: z.string().url().optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().or(z.literal('')).optional(),
  address: z.string().trim().max(300).optional(),
  hours: z.string().trim().max(300).optional(),
  social: z.string().trim().max(500).optional(),
  paymentInfo: z.object({
    method: z.enum(['mobile_money', 'bank_transfer', 'orange_money', 'mtn_money']),
    accountNumber: z.string(),
    accountName: z.string(),
    operator: z.string().optional()
  }).optional()
});

const sellerSettingsSchema = z.object({
  storeName: z.string().trim().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  logo: z.string().url().or(z.literal('')).optional(),
  paymentInfo: z.record(z.unknown()).optional(),
}).strict();

const approveSellerSchema = z.object({
  status: z.enum(['approved', 'suspended']),
  commissionRate: z.number().min(0).max(100).optional()
});

// ==================== ROUTES PUBLIQUES ====================

// GET liste des vendeurs (approuvés uniquement)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { status: 'approved' };
    if (search) {
      where.OR = [
        { storeName: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [sellers, total] = await Promise.all([
      db.seller.findMany({
        where,
        select: {
          id: true, storeName: true, slug: true, description: true, logo: true,
          rating: true, reviewCount: true,
          _count: { select: { products: true } }
        },
        orderBy: { totalSales: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      db.seller.count({ where })
    ]);

    res.json({
      sellers: sellers.map(s => ({
        ...s,
        productCount: s._count.products
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erreur GET /sellers:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET profil vendeur par slug (public)
router.get('/slug/:slug', async (req, res) => {
  try {
    const seller = await db.seller.findFirst({
      where: { slug: req.params.slug, status: 'approved' },
      select: {
        id: true,
        storeName: true,
        slug: true,
        description: true,
        logo: true,
        rating: true,
        reviewCount: true,
        totalSales: true,
        createdAt: true,
        products: {
          where: { status: 'active' },
          take: 48,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            price: true,
            image: true,
            categoryId: true,
            createdAt: true,
            category: { select: { id: true, name: true } },
            _count: { select: { reviews: true } },
          }
        },
        _count: { select: { products: true } }
      }
    });

    if (!seller) {
      return res.status(404).json({ error: 'Vendeur non trouvé' });
    }

    // Moyenne des avis par produit (requête légère)
    const productIds = seller.products.map((p) => p.id);
    let ratingByProduct = {};
    if (productIds.length > 0) {
      const grouped = await db.review.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _avg: { rating: true },
        _count: { rating: true },
      });
      ratingByProduct = Object.fromEntries(
        grouped.map((g) => [g.productId, { avg: g._avg.rating || 0, count: g._count.rating || 0 }])
      );
    }

    const products = seller.products.map((p) => {
      const { _count, ...rest } = p;
      const stats = ratingByProduct[p.id] || { avg: 0, count: _count?.reviews || 0 };
      return {
        ...rest,
        rating: Math.round((stats.avg || 0) * 10) / 10,
        reviewCount: stats.count,
      };
    });

    res.json({
      ...seller,
      products,
      productCount: seller._count.products
    });
  } catch (error) {
    console.error('Erreur GET /sellers/slug/:slug:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== INSCRIPTION VENDEUR (avant /:id) ====================

// POST inscription vendeur (authentifié)
router.post('/register', requireAuth, async (req, res) => {
  try {
    const data = registerSellerSchema.parse(req.body);

    const existingSeller = await db.seller.findUnique({
      where: { userId: req.user.userId }
    });
    if (existingSeller) {
      return res.status(409).json({ error: 'Vous avez déjà un compte vendeur.' });
    }

    const slug = data.slug || slugify(data.storeName);
    const slugExists = await db.seller.findUnique({ where: { slug } });
    if (slugExists) {
      return res.status(409).json({ error: 'Ce nom de boutique est déjà pris. Choisissez un autre slug.' });
    }

    const seller = await db.seller.create({
      data: {
        userId: req.user.userId,
        storeName: data.storeName,
        slug,
        description: data.description,
        logo: data.logo,
        status: 'pending' // Attente approbation admin
      }
    });

    await db.user.update({
      where: { id: req.user.userId },
      data: { role: 'seller' }
    });

    res.status(201).json({
      seller: {
        id: seller.id,
        storeName: seller.storeName,
        slug: seller.slug,
        status: seller.status,
        message: 'Inscription envoyée. Votre compte sera activé après vérification.'
      }
    });
  } catch (error) {
    console.error('Erreur POST /sellers/register:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Données invalides', details: error.errors });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== DASHBOARD VENDEUR (avant /:id) ====================

// GET vérifier si l'utilisateur a un compte vendeur (même en attente)
router.get('/me/status', requireAuth, async (req, res) => {
  try {
    const seller = await db.seller.findUnique({ where: { userId: req.user.userId } });
    res.json({ hasSeller: !!seller, status: seller?.status || null });
  } catch (error) {
    console.error('Erreur GET /sellers/me/status:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET mon profil vendeur
router.get('/me/profile', requireAuth, requireSeller, async (req, res) => {
  try {
    const seller = await db.seller.findUnique({
      where: { id: req.seller.id },
      include: {
        user: { select: { email: true, name: true } }
      }
    });
    const settings = seller.paymentInfo && typeof seller.paymentInfo === 'object' && !Array.isArray(seller.paymentInfo)
      ? seller.paymentInfo : {};
    res.json({
      ...seller,
      phone: settings.phone || '',
      email: settings.email || '',
      address: settings.address || '',
      hours: settings.hours || '',
      social: settings.social || '',
      access: req.sellerAccess,
    });
  } catch (error) {
    console.error('Erreur GET /sellers/me/profile:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT modifier mon profil vendeur
router.put('/me/profile', requireAuth, requireSeller, async (req, res) => {
  try {
    const data = updateSellerSchema.parse(req.body);

    if (data.storeName) {
      const slug = slugify(data.storeName);
      const slugExists = await db.seller.findFirst({
        where: { slug, id: { not: req.seller.id } }
      });
      if (slugExists) {
        return res.status(409).json({ error: 'Ce nom de boutique est déjà pris.' });
      }
    }

    const { phone, email, address, hours, social, paymentInfo, ...sellerFields } = data;
    const presentation = Object.fromEntries(
      Object.entries({ phone, email, address, hours, social }).filter(([, value]) => value !== undefined)
    );
    const currentPaymentInfo = req.seller.paymentInfo && typeof req.seller.paymentInfo === 'object' && !Array.isArray(req.seller.paymentInfo)
      ? req.seller.paymentInfo : {};
    const shouldUpdatePaymentInfo = paymentInfo !== undefined || Object.keys(presentation).length > 0;
    const seller = await db.seller.update({
      where: { id: req.seller.id },
      data: {
        ...sellerFields,
        ...(shouldUpdatePaymentInfo && { paymentInfo: { ...currentPaymentInfo, ...(paymentInfo || {}), ...presentation } }),
      }
    });
    res.json(seller);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Données invalides', details: error.errors });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== PRODUITS VENDEUR (MM-BE-060) ====================

// GET mes produits (avec filtres avancés, recherche et inventaire)
router.get('/me/products', requireAuth, requireSeller, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, categoryId, stockStatus } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = { sellerId: req.seller.id };
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (stockStatus === 'low') {
      where.stock = { lte: 5 };
    } else if (stockStatus === 'out') {
      where.stock = 0;
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          inventory: true,
          _count: { select: { orderItems: true, reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      db.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erreur GET /sellers/me/products:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des produits' });
  }
});

// GET /api/sellers/me/products/export - Export CSV des produits vendeur
router.get('/me/products/export', requireAuth, requireSeller, async (req, res) => {
  try {
    const products = await db.product.findMany({
      where: { sellerId: req.seller.id },
      include: { category: { select: { name: true } }, inventory: true },
      orderBy: { createdAt: 'desc' },
    });

    const headers = 'ID,Nom,SKU,Categorie,Prix_FCFA,Stock,Statut,Date_Creation\n';
    const rows = products.map(p => {
      const name = (p.name || '').replace(/"/g, '""');
      const cat = (p.category?.name || '').replace(/"/g, '""');
      const price = (p.price / 100).toFixed(2);
      const stock = p.inventory?.quantity ?? p.stock ?? 0;
      const date = new Date(p.createdAt).toISOString().slice(0, 10);
      return `${p.id},"${name}","${p.sku || ''}","${cat}",${price},${stock},${p.status},${date}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="produits-${req.seller.slug}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(headers + rows);
  } catch (error) {
    console.error('Erreur export CSV produits:', error);
    res.status(500).json({ error: 'Erreur lors de l’export des produits' });
  }
});

// POST /api/sellers/me/products/bulk - Actions en masse (activer, désactiver, archiver, supprimer)
router.post('/me/products/bulk', requireAuth, requireSeller, async (req, res) => {
  try {
    const { action, productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Liste d’identifiants de produits requise' });
    }

    const ids = productIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (action === 'activate') {
      await db.product.updateMany({
        where: { id: { in: ids }, sellerId: req.seller.id },
        data: { status: 'active' },
      });
      return res.json({ success: true, message: `${ids.length} produits activés.` });
    } else if (action === 'deactivate') {
      await db.product.updateMany({
        where: { id: { in: ids }, sellerId: req.seller.id },
        data: { status: 'draft' },
      });
      return res.json({ success: true, message: `${ids.length} produits désactivés.` });
    } else if (action === 'archive') {
      await db.product.updateMany({
        where: { id: { in: ids }, sellerId: req.seller.id },
        data: { status: 'archived' },
      });
      return res.json({ success: true, message: `${ids.length} produits archivés.` });
    } else if (action === 'delete') {
      // Vérifier les commandes avant suppression
      const inOrders = await db.orderItem.findMany({
        where: { productId: { in: ids } },
        select: { productId: true },
      });
      const inOrderSet = new Set(inOrders.map(o => o.productId));
      const safeToDelete = ids.filter(id => !inOrderSet.has(id));
      const toArchive = ids.filter(id => inOrderSet.has(id));

      if (toArchive.length > 0) {
        await db.product.updateMany({
          where: { id: { in: toArchive }, sellerId: req.seller.id },
          data: { status: 'archived' },
        });
      }
      if (safeToDelete.length > 0) {
        await db.inventory.deleteMany({ where: { productId: { in: safeToDelete } } });
        await db.product.deleteMany({
          where: { id: { in: safeToDelete }, sellerId: req.seller.id },
        });
      }

      return res.json({
        success: true,
        message: `${safeToDelete.length} produits supprimés, ${toArchive.length} archivés (car présents dans des commandes).`,
      });
    }

    res.status(400).json({ error: 'Action inconnue. Valeurs acceptées: activate, deactivate, archive, delete' });
  } catch (error) {
    console.error('Erreur bulk products:', error);
    res.status(500).json({ error: 'Erreur lors de l’opération groupée' });
  }
});

// POST /api/sellers/me/products/:id/duplicate - Dupliquer un produit
router.post('/me/products/:id/duplicate', requireAuth, requireSeller, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Identifiant produit invalide' });
    }
    const orig = await db.product.findUnique({
      where: { id },
      include: { inventory: true },
    });

    if (!orig || orig.sellerId !== req.seller.id) {
      return res.status(404).json({ error: 'Produit introuvable ou non autorisé' });
    }

    const newSku = `MM-${req.seller.slug.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const initialStock = orig.inventory?.quantity ?? orig.stock ?? 0;

    const duplicated = await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: `[Copie] ${orig.name}`,
          price: orig.price,
          categoryId: orig.categoryId,
          sellerId: req.seller.id,
          image: orig.image,
          images: orig.images,
          description: orig.description,
          stock: initialStock,
          status: 'draft',
          sku: newSku,
          brand: orig.brand,
          condition: orig.condition,
          material: orig.material,
          styles: orig.styles,
          colors: orig.colors,
          features: orig.features,
        },
      });

      await tx.inventory.create({
        data: {
          productId: p.id,
          quantity: initialStock,
          reserved: 0,
          available: initialStock,
          lowStockThreshold: orig.inventory?.lowStockThreshold ?? 5,
        },
      });

      return p;
    });

    res.status(201).json(duplicated);
  } catch (error) {
    console.error('Erreur duplication produit:', error);
    res.status(500).json({ error: 'Erreur lors de la duplication' });
  }
});

// PUT /api/sellers/me/products/:id/status - Activer / Désactiver / Archiver
router.put('/me/products/:id/status', requireAuth, requireSeller, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Identifiant produit invalide' });
    }
    const { status } = req.body;
    if (!['active', 'draft', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide (active, draft, archived)' });
    }

    const prod = await db.product.findUnique({ where: { id } });
    if (!prod || prod.sellerId !== req.seller.id) {
      return res.status(404).json({ error: 'Produit introuvable ou non autorisé' });
    }

    const updated = await db.product.update({
      where: { id },
      data: { status },
    });

    res.json(updated);
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/sellers/me/products/:id/stock - Mise à jour directe du stock
router.put('/me/products/:id/stock', requireAuth, requireSeller, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Identifiant produit invalide' });
    }
    const { quantity, lowStockThreshold = 5 } = req.body;
    const qty = parseInt(quantity, 10);

    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: 'Quantité de stock invalide' });
    }

    const prod = await db.product.findUnique({ where: { id } });
    if (!prod || prod.sellerId !== req.seller.id) {
      return res.status(404).json({ error: 'Produit introuvable ou non autorisé' });
    }

    const updated = await require('./services/transaction').transaction((tx) =>
      require('./services/inventory.service').setPhysical(tx, id, qty, Number(lowStockThreshold)));

    res.json({ success: true, stock: qty, inventory: updated });
  } catch (error) {
    console.error('Erreur mise à jour stock:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du stock' });
  }
});

// GET /api/sellers/me/products/:id/stats - Statistiques de performance d'un produit
router.get('/me/products/:id/stats', requireAuth, requireSeller, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Identifiant produit invalide' });
    }
    const prod = await db.product.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: { order: { select: { status: true, createdAt: true } } },
        },
        reviews: true,
      },
    });

    if (!prod || prod.sellerId !== req.seller.id) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    const validItems = prod.orderItems.filter(it => it.order && it.order.status !== 'CANCELLED');
    const unitsSold = validItems.reduce((sum, it) => sum + it.quantity, 0);
    const revenueGenerated = validItems.reduce((sum, it) => sum + it.totalPrice, 0);
    const earningsGenerated = validItems.reduce((sum, it) => sum + (it.sellerEarnings || it.totalPrice), 0);
    const avgRating = prod.reviews.length > 0
      ? prod.reviews.reduce((sum, r) => sum + r.rating, 0) / prod.reviews.length
      : 0;

    res.json({
      productId: id,
      name: prod.name,
      unitsSold,
      revenueGenerated,
      earningsGenerated,
      orderCount: validItems.length,
      reviewCount: prod.reviews.length,
      averageRating: parseFloat(avgRating.toFixed(1)),
      stockCurrent: prod.stock,
    });
  } catch (error) {
    console.error('Erreur stats produit:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== COMMANDES VENDEUR (MM-BE-061) ====================

const sellerOrderListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  search: z.string().trim().max(100).optional(),
}).strict();

// GET mes commandes (filtrées et paginées)
router.get('/me/orders', requireAuth, requireSeller, async (req, res) => {
  try {
    const { page: pageNum, limit: limitNum, status, search } = sellerOrderListSchema.parse(req.query);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      items: { some: { sellerId: req.seller.id } },
    };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search.trim(), mode: 'insensitive' } },
        { customer: { firstName: { contains: search.trim(), mode: 'insensitive' } } },
        { customer: { lastName: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
            items: {
            where: { sellerId: req.seller.id },
            include: { product: { select: { id: true, name: true, sku: true, image: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      db.order.count({ where }),
    ]);

    // Recalculer le total spécifique à ce vendeur pour chaque commande
    const sanitizedOrders = orders.map(o => {
      const sellerTotal = o.items.reduce((sum, it) => sum + it.totalPrice, 0);
      const sellerEarnings = o.items.reduce((sum, it) => sum + (it.sellerEarnings || it.totalPrice), 0);
      return {
        ...require('./services/order-access.service').publicOrder(o),
        sellerTotal,
        sellerEarnings,
      };
    });

    res.json({
      orders: sanitizedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Filtres invalides', details: error.errors });
    console.error('Erreur GET /sellers/me/orders:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sellers/me/orders/:id - Détail de la commande avec bordereau d'expédition
router.get('/me/orders/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const order = await db.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: {
          where: { sellerId: req.seller.id },
          include: { product: true },
        },
      },
    });

    if (!order || order.items.length === 0) {
      return res.status(404).json({ error: 'Commande introuvable ou ne contenant aucun de vos articles' });
    }

    const sellerTotal = order.items.reduce((sum, it) => sum + it.totalPrice, 0);
    const sellerEarnings = order.items.reduce((sum, it) => sum + (it.sellerEarnings || it.totalPrice), 0);

    res.json({
      ...require('./services/order-access.service').publicOrder(order),
      sellerTotal,
      sellerEarnings,
    });
  } catch (error) {
    console.error('Erreur GET /sellers/me/orders/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/sellers/me/orders/:id/status - Action logistique vendeur (préparation, expédition)
router.put('/me/orders/:id/status', requireAuth, requireSeller, async (req, res) => {
  try {
    const { status, carrierName, trackingNumber, note } = z.object({
      status: z.enum(['PROCESSING', 'SHIPPED']), carrierName: z.string().max(100).optional(),
      trackingNumber: z.string().max(100).optional(), note: z.string().max(500).optional(),
    }).parse(req.body);
    const { OrderService } = require('./services/order.service');
    const order = await OrderService.transitionSellerFulfillment(req.params.id, req.seller.id, status, {
      userId: req.user.userId, reason: note, carrier: carrierName, trackingCode: trackingNumber,
    });
    const notificationOrder = await db.order.findUnique({ where: { id: req.params.id }, include: { customer: true, shipping: true } });
    if (notificationOrder?.customer) await require('./services/email.service').sendOrderStatusUpdate(notificationOrder.customer, notificationOrder, order.status);
    res.json({ success: true, order });
  } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }); }
});

// GET /api/sellers/me/orders/:id/packing-slip - Bordereau d'expédition imprimable
router.get('/me/orders/:id/packing-slip', requireAuth, requireSeller, async (req, res) => {
  try {
    const order = await db.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: {
          where: { sellerId: req.seller.id },
          include: { product: true },
        },
      },
    });

    if (!order || order.items.length === 0) {
      return res.status(404).json({ error: 'Bordereau introuvable' });
    }

    res.json({
      store: {
        name: req.seller.storeName,
        slug: req.seller.slug,
        contact: req.seller.user?.email,
      },
      order: {
        orderNumber: order.orderNumber,
        date: order.createdAt,
        status: order.status,
      },
      recipient: {
        name: `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim(),
        phone: order.customer?.phone || '',
        address: order.shippingAddress,
      },
      items: order.items.map(it => ({
        name: it.product?.name || 'Article',
        sku: it.product?.sku || 'N/A',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      totalQuantity: order.items.reduce((s, it) => s + it.quantity, 0),
    });
  } catch (error) {
    console.error('Erreur packing-slip:', error);
    res.status(500).json({ error: 'Erreur génération bordereau' });
  }
});

// ==================== AVIS ET SUPPORT VENDEUR (MM-BE-062) ====================

// GET /api/sellers/me/reviews - Avis sur mes produits
router.get('/me/reviews', requireAuth, requireSeller, async (req, res) => {
  try {
    const reviews = await db.review.findMany({
      where: { product: { sellerId: req.seller.id } },
      include: { product: { select: { id: true, name: true, sku: true, image: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(reviews);
  } catch (error) {
    console.error('Erreur GET /me/reviews:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/sellers/me/reviews/:id/reply - Réponse vendeur à un avis
router.post('/me/reviews/:id/reply', requireAuth, requireSeller, async (req, res) => {
  try {
    const { reply } = z.object({ reply: z.string().trim().min(1).max(2000) }).parse(req.body);
    const updated = await ReviewService.replyToReview(db, {
      sellerId: req.seller.id,
      reviewId: req.params.id,
      reply,
    });
    await db.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'SELLER_REVIEW_REPLIED',
        entity: 'Review',
        entityId: updated.id,
        details: { sellerId: req.seller.id },
        ipAddress: req.ip,
      },
    });
    res.json({ success: true, review: updated });
  } catch (error) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Réponse invalide', details: error.errors });
    const status = error?.statusCode || 500;
    if (status >= 500) console.error('Erreur réponse avis:', error);
    res.status(status).json({ error: status >= 500 ? 'Erreur serveur' : error.message });
  }
});

// GET /api/sellers/me/notifications - Notifications vendeur
router.get('/me/notifications', requireAuth, requireSeller, async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.notification.count({ where: { userId: req.user.userId, isRead: false } }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Erreur notifs vendeur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/sellers/me/notifications/:id/read - Marquer une notification du vendeur comme lue.
async function markSellerNotificationRead(req, res) {
  try {
    const updated = await db.notification.updateMany({
      where: { id: req.params.id, userId: req.user.userId },
      data: { isRead: true },
    });
    if (updated.count === 0) return res.status(404).json({ error: 'Notification introuvable' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
router.patch('/me/notifications/:id/read', requireAuth, requireSeller, markSellerNotificationRead);
router.put('/me/notifications/:id/read', requireAuth, requireSeller, markSellerNotificationRead);

// PATCH /api/sellers/me/notifications/read-all - Marquer toutes comme lues.
async function markAllSellerNotificationsRead(req, res) {
  try {
    const updated = await db.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, updated: updated.count });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
router.patch('/me/notifications/read-all', requireAuth, requireSeller, markAllSellerNotificationsRead);
router.post('/me/notifications/read-all', requireAuth, requireSeller, markAllSellerNotificationsRead);

// GET /api/sellers/me/support/tickets - Liste des tickets support vendeur
router.get('/me/support/tickets', requireAuth, requireSeller, async (req, res) => {
  try {
    const supportTickets = require('./services/support-ticket.service');
    const tickets = await db.supportTicket.findMany({
      where: { sellerId: req.seller.id },
      include: supportTickets.ticketDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(tickets.map(supportTickets.formatSellerTicket));
  } catch (error) {
    console.error('Erreur support tickets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/sellers/me/support/tickets - Ouvrir un ticket support
router.post('/me/support/tickets', requireAuth, requireSeller, async (req, res) => {
  try {
    const input = z.object({
      category: z.string().trim().max(100).optional(),
      subject: z.string().trim().min(3).max(160),
      message: z.string().trim().min(10).max(5000),
    }).parse(req.body);

    const sellerUser = await db.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true, name: true },
    });
    const supportTickets = require('./services/support-ticket.service');
    const ticket = await supportTickets.createTicket({
      source: 'SELLER',
      category: input.category || 'Autre',
      subject: input.subject,
      message: input.message,
      requesterName: sellerUser?.name || req.seller.storeName,
      requesterEmail: sellerUser?.email || 'vendeur@mandemarket.invalid',
      sellerId: req.seller.id,
      createdById: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    const emailService = require('./services/email.service');
    const delivered = await emailService.sendContactMessageNotification({
      name: `${sellerUser?.name || req.seller.storeName} — ${req.seller.storeName}`,
      email: sellerUser?.email || 'vendeur@mandemarket.invalid',
      subject: `[Ticket ${ticket.reference}] ${input.subject}`,
      message: input.message,
    });
    if (!delivered.success) {
      console.warn(`[Support] Ticket ${ticket.reference} persisté; notification email non disponible:`, delivered.error || 'erreur inconnue');
    }
    res.status(201).json({ ...supportTickets.formatSellerTicket(ticket), notificationQueued: delivered.success });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Ticket invalide', details: error.errors });
    console.error('Erreur création support ticket:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sellers/me/customers - Liste des clients ayant commandé dans cette boutique
router.get('/me/customers', requireAuth, requireSeller, async (req, res) => {
  try {
    const orders = await db.order.findMany({
      where: {
        items: { some: { sellerId: req.seller.id } },
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const customersMap = new Map();
    for (const o of orders) {
      if (o.customer && !customersMap.has(o.customer.email)) {
        customersMap.set(o.customer.email, {
          id: o.customer.id,
          name: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
          email: o.customer.email,
          phone: o.customer.phone || '',
          lastOrderDate: o.createdAt,
          lastOrderNumber: o.orderNumber,
        });
      }
    }

    res.json(Array.from(customersMap.values()));
  } catch (error) {
    console.error('Erreur clients vendeur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/sellers/me/messages/send - Envoyer réellement un email à un client de la boutique.
router.post('/me/messages/send', requireAuth, requireSeller, async (req, res) => {
  try {
    const data = z.object({
      customerEmail: z.string().trim().toLowerCase().email(),
      subject: z.string().trim().min(1).max(160),
      content: z.string().trim().min(1).max(5000),
    }).parse(req.body);
    const customer = await db.customer.findFirst({
      where: { email: data.customerEmail, orders: { some: { items: { some: { sellerId: req.seller.id } } } } },
      select: { id: true, email: true, firstName: true },
    });
    if (!customer) return res.status(404).json({ error: 'Client introuvable pour cette boutique.' });
    const emailService = require('./services/email.service');
    const sent = await emailService.sendSellerCustomerMessage({
      to: customer.email, customerName: customer.firstName, storeName: req.seller.storeName,
      subject: data.subject, message: data.content,
    });
    if (!sent.success) return res.status(503).json({ error: 'Envoi email temporairement indisponible.' });
    await db.auditLog.create({
      data: {
        userId: req.user.userId, action: 'SELLER_MESSAGE_SENT', entity: 'CustomerMessage', entityId: customer.id,
        details: { recipientEmail: customer.email, subject: data.subject, messageId: sent.messageId || null },
        ipAddress: req.ip, userAgent: req.headers['user-agent'] || null,
      },
    });
    res.json({ success: true, message: 'Message envoyé au client.' });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Message invalide', details: error.errors });
    console.error('Erreur envoi message client:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== MARKETING & PROMOTIONS (MM-BE-063) ====================

const sellerPromotionSchema = z.object({
  code: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  value: z.coerce.number().positive(),
  minAmount: z.coerce.number().min(0).optional(),
  maxUses: z.coerce.number().int().positive().max(100000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.get('/me/promotions', requireAuth, requireSeller, async (req, res) => {
  try {
    const promos = await db.promotion.findMany({
      where: { sellerId: req.seller.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(promos);
  } catch (error) {
    console.error('Erreur GET /me/promotions:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/me/promotions', requireAuth, requireSeller, async (req, res) => {
  try {
    const input = sellerPromotionSchema.parse(req.body);
    const code = input.code.toUpperCase();
    if (input.type === 'PERCENTAGE' && input.value > 100) {
      return res.status(400).json({ error: 'Le pourcentage doit être compris entre 1 et 100.' });
    }
    const startDate = input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : new Date();
    const endDate = input.endDate ? new Date(`${input.endDate}T23:59:59.999Z`) : new Date(Date.now() + 30 * 86400000);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
      return res.status(400).json({ error: 'Période de promotion invalide.' });
    }
    if (await db.promotion.findUnique({ where: { code } })) {
      return res.status(409).json({ error: 'Ce code promo existe déjà.' });
    }
    const promo = await db.promotion.create({
      data: {
        sellerId: req.seller.id,
        code,
        name: input.name,
        description: input.description || `Promotion ${req.seller.storeName}`,
        type: input.type,
        value: input.type === 'FIXED_AMOUNT' ? Math.round(input.value * 100) : Math.round(input.value),
        minAmount: input.minAmount ? Math.round(input.minAmount * 100) : null,
        maxUses: input.maxUses || null,
        startDate,
        endDate,
        isActive: true,
      },
    });
    await db.auditLog.create({
      data: { userId: req.user.userId, action: 'SELLER_PROMOTION_CREATED', entity: 'Promotion', entityId: promo.id,
        details: { sellerId: req.seller.id, code: promo.code, type: promo.type }, ipAddress: req.ip },
    });
    res.status(201).json(promo);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Promotion invalide', details: error.errors });
    console.error('Erreur création promo vendeur:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la promotion' });
  }
});

router.delete('/me/promotions/:id', requireAuth, requireSeller, async (req, res) => {
  try {
    const result = await db.promotion.updateMany({
      where: { id: req.params.id, sellerId: req.seller.id, isActive: true },
      data: { isActive: false },
    });
    if (result.count !== 1) return res.status(404).json({ error: 'Promotion introuvable.' });
    await db.auditLog.create({
      data: { userId: req.user.userId, action: 'SELLER_PROMOTION_DISABLED', entity: 'Promotion', entityId: req.params.id,
        details: { sellerId: req.seller.id }, ipAddress: req.ip },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur désactivation code vendeur:', error);
    res.status(500).json({ error: 'Erreur désactivation code' });
  }
});

// ==================== PARAMÈTRES, ÉQUIPE & BOUTIQUE (MM-BE-064) ====================

// GET /api/sellers/me/settings
router.get('/me/settings', requireAuth, requireSeller, async (req, res) => {
  res.json({
    storeName: req.seller.storeName,
    slug: req.seller.slug,
    description: req.seller.description,
    logo: req.seller.logo,
    commissionRate: req.seller.commissionRate,
    paymentInfo: req.seller.paymentInfo,
  });
});

// PUT /api/sellers/me/settings
router.put('/me/settings', requireAuth, requireSeller, async (req, res) => {
  try {
    const { storeName, description, logo, paymentInfo } = sellerSettingsSchema.parse(req.body);
    const currentPaymentInfo = req.seller.paymentInfo && typeof req.seller.paymentInfo === 'object' && !Array.isArray(req.seller.paymentInfo)
      ? req.seller.paymentInfo : {};
    const updated = await db.seller.update({
      where: { id: req.seller.id },
      data: {
        ...(storeName && { storeName: storeName.trim() }),
        ...(description !== undefined && { description }),
        ...(logo !== undefined && { logo }),
        ...(paymentInfo && { paymentInfo: { ...currentPaymentInfo, ...paymentInfo } }),
      },
    });
    res.json({ success: true, seller: updated });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Paramètres invalides', details: error.errors });
    res.status(500).json({ error: 'Erreur mise à jour paramètres' });
  }
});

// GET /api/sellers/me/team - Liste des membres de la boutique
router.get('/me/team', requireAuth, requireSeller, async (req, res) => {
  try {
    const [seller, members, invitations] = await Promise.all([
      db.seller.findUnique({ where: { id: req.seller.id }, include: { user: { select: { id: true, name: true, email: true } } } }),
      db.sellerMember.findMany({ where: { sellerId: req.seller.id }, include: { user: { select: { name: true, email: true } } }, orderBy: { joinedAt: 'asc' } }),
      db.sellerInvitation.findMany({ where: { sellerId: req.seller.id, status: 'pending' }, orderBy: { createdAt: 'desc' } }),
    ]);
    await db.sellerInvitation.updateMany({ where: { sellerId: req.seller.id, status: 'pending', expiresAt: { lte: new Date() } }, data: { status: 'expired' } });
    res.json({
      members: [{ id: seller.user.id, name: seller.user.name || seller.storeName, email: seller.user.email,
        role: 'owner', status: 'active', permissions: ['*'], joinedAt: seller.createdAt },
      ...members.map((member) => ({ id: member.id, name: member.user.name, email: member.user.email,
        role: member.role, status: member.status, permissions: member.permissions, joinedAt: member.joinedAt }))],
      invitations: invitations.filter((invitation) => invitation.expiresAt > new Date()).map((invitation) => ({
        id: invitation.id, email: invitation.email, role: invitation.role, status: invitation.status,
        permissions: invitation.permissions, createdAt: invitation.createdAt, expiresAt: invitation.expiresAt,
      })),
    });
  } catch (error) {
    console.error('Erreur GET equipe vendeur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(['manager', 'catalog', 'orders', 'finance']) }).strict();
async function inviteTeamMember(req, res) {
  try {
    const input = inviteSchema.parse(req.body);
    const owner = await db.user.findUnique({ where: { id: req.seller.userId }, select: { email: true } });
    if ([owner?.email, req.user.email].filter(Boolean).map((email) => email.toLowerCase()).includes(input.email)) {
      return res.status(409).json({ error: 'Vous ne pouvez pas vous inviter vous-même.' });
    }
    const existingUser = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existingUser && await db.sellerMember.findUnique({ where: { sellerId_userId: { sellerId: req.seller.id, userId: existingUser.id } } })) {
      return res.status(409).json({ error: 'Cette personne appartient déjà à la boutique.' });
    }
    const duplicate = await db.sellerInvitation.findFirst({ where: { sellerId: req.seller.id, email: input.email,
      status: 'pending', expiresAt: { gt: new Date() } } });
    if (duplicate) return res.status(409).json({ error: 'Une invitation active existe déjà pour cette adresse.' });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invitation = await db.$transaction(async (tx) => {
      const created = await tx.sellerInvitation.create({ data: { sellerId: req.seller.id, email: input.email,
        role: input.role, permissions: permissionsForRole(input.role), tokenHash, invitedById: req.user.userId,
        expiresAt: new Date(Date.now() + 7 * 86400000) } });
      await tx.auditLog.create({ data: { userId: req.user.userId, action: 'SELLER_TEAM_INVITED', entity: 'SellerInvitation',
        entityId: created.id, details: { sellerId: req.seller.id, email: input.email, role: input.role }, ipAddress: req.ip } });
      return created;
    });
    const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/vendeur/invitation#token=${rawToken}`;
    await require('./services/email.service').sendSellerInvitation({ to: input.email, storeName: req.seller.storeName,
      role: input.role, inviteUrl, invitationId: invitation.id });
    res.status(201).json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role,
      status: invitation.status, createdAt: invitation.createdAt } });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Invitation invalide', details: error.errors });
    console.error('Erreur invitation équipe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
router.post('/me/team/invite', requireAuth, requireSeller, inviteTeamMember);
router.post('/me/team/invitations', requireAuth, requireSeller, inviteTeamMember);

router.post('/invitations/:token/accept', requireAuth, async (req, res) => {
  try {
    const token = z.string().regex(/^[a-f0-9]{64}$/).parse(req.params.token);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await db.$transaction(async (tx) => {
      const current = await tx.sellerInvitation.findUnique({ where: { tokenHash } });
      if (!current || current.status !== 'pending' || current.expiresAt <= new Date()) throw Object.assign(new Error('Invitation invalide ou expirée'), { statusCode: 400 });
      if (current.email !== req.user.email.toLowerCase()) throw Object.assign(new Error('Cette invitation appartient à une autre adresse.'), { statusCode: 403 });
      await tx.sellerMember.upsert({ where: { sellerId_userId: { sellerId: current.sellerId, userId: req.user.userId } },
        create: { sellerId: current.sellerId, userId: req.user.userId, role: current.role, permissions: current.permissions },
        update: { role: current.role, permissions: current.permissions, status: 'active', joinedAt: new Date() } });
      const accepted = await tx.sellerInvitation.update({ where: { id: current.id }, data: {
        status: 'accepted', acceptedById: req.user.userId, acceptedAt: new Date(),
      } });
      await tx.auditLog.create({ data: { userId: req.user.userId, action: 'SELLER_TEAM_INVITATION_ACCEPTED',
        entity: 'SellerInvitation', entityId: current.id, details: { sellerId: current.sellerId, role: current.role }, ipAddress: req.ip } });
      return accepted;
    });
    const user = await db.user.findUnique({ where: { id: req.user.userId }, include: { customer: true, seller: true } });
    const staffSession = await require('./services/session.service').issueSession(user, req, res, 'staff');
    res.json({ success: true, sellerId: invitation.sellerId, role: invitation.role,
      permissions: invitation.permissions, accessToken: staffSession.accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(error.statusCode || (error.name === 'ZodError' ? 400 : 500)).json({ error: error.statusCode || error.name === 'ZodError' ? error.message : 'Erreur serveur' });
  }
});

const notificationPreferenceSchema = z.object({
  newOrder: z.boolean(), newMessage: z.boolean(), newReview: z.boolean(), newFollower: z.boolean(),
  lowStock: z.boolean(), payments: z.boolean(), marketing: z.boolean(), platformMessages: z.boolean(),
}).strict();

router.get('/me/notification-preferences', requireAuth, requireSeller, async (req, res) => {
  const preferences = await db.sellerNotificationPreference.upsert({ where: { sellerId: req.seller.id },
    create: { sellerId: req.seller.id }, update: {} });
  res.json({ preferences: Object.fromEntries(Object.keys(notificationPreferenceSchema.shape).map((key) => [key, preferences[key]])) });
});

router.put('/me/notification-preferences', requireAuth, requireSeller, async (req, res) => {
  try {
    const patch = notificationPreferenceSchema.partial().refine((value) => Object.keys(value).length > 0, 'Au moins une préférence est requise').parse(req.body);
    const preferences = await db.$transaction(async (tx) => {
      const updated = await tx.sellerNotificationPreference.upsert({ where: { sellerId: req.seller.id },
        create: { sellerId: req.seller.id, ...patch }, update: patch });
      await tx.auditLog.create({ data: { userId: req.user.userId, action: 'SELLER_NOTIFICATION_PREFERENCES_UPDATED',
        entity: 'Seller', entityId: req.seller.id, details: { changed: Object.keys(patch) }, ipAddress: req.ip } });
      return updated;
    });
    res.json({ preferences: Object.fromEntries(Object.keys(notificationPreferenceSchema.shape).map((key) => [key, preferences[key]])) });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Préférences invalides', details: error.errors });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sellers/me/balance - 4 soldes réels du vendeur (MM-BE-052 / MM-FE-050)
router.get('/me/balance', requireAuth, requireSeller, async (req, res) => {
  try {
    const LedgerService = require('./services/ledger.service');
    const balances = await LedgerService.getSellerBalances(req.seller.id);
    res.json({ balances });
  } catch (error) {
    console.error('Erreur GET /sellers/me/balance:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sellers/me/ledger - Registre comptable vendeur paginé (MM-BE-052)
router.get('/me/ledger', requireAuth, requireSeller, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { sellerId: req.seller.id };
    if (type) where.type = type;
    if (status) where.status = status;

    const [entries, total] = await Promise.all([
      db.sellerLedgerEntry.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, status: true } },
          payout: { select: { id: true, status: true, method: true, reference: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      db.sellerLedgerEntry.count({ where }),
    ]);

    res.json({
      entries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Erreur GET /sellers/me/ledger:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sellers/me/ledger/export - Export CSV comptable vendeur (MM-FE-050)
router.get('/me/ledger/export', requireAuth, requireSeller, async (req, res) => {
  try {
    const entries = await db.sellerLedgerEntry.findMany({
      where: { sellerId: req.seller.id },
      include: {
        order: { select: { orderNumber: true } },
        payout: { select: { reference: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const headers = 'Date,Type,Description,Montant_Brut_FCFA,Commission_FCFA,Net_Vendeur_FCFA,Statut,Reference\n';
    const rows = entries.map(e => {
      const date = new Date(e.createdAt).toISOString().slice(0, 10);
      const brut = (e.amount / 100).toFixed(2);
      const com = (e.feeAmount / 100).toFixed(2);
      const net = (e.netAmount / 100).toFixed(2);
      const ref = e.order?.orderNumber || e.payout?.reference || e.id.slice(0, 8);
      const desc = (e.description || '').replace(/,/g, ';');
      return `${date},${e.type},"${desc}",${brut},${com},${net},${e.status},${ref}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ledger-mandemarket-${req.seller.slug}-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(headers + rows);
  } catch (error) {
    console.error('Erreur export CSV ledger:', error);
    res.status(500).json({ error: 'Erreur lors de l’export CSV' });
  }
});

// POST demander un versement (MM-BE-051 / MM-BE-052)
const handlePayoutRequest = async (req, res) => {
  try {
    const { amount, method } = req.body;
    const amountNum = Math.round(Number(amount) || 0);

    const LedgerService = require('./services/ledger.service');
    const payoutMethod = method || req.seller.paymentInfo?.method || 'bank_transfer';

    const payout = await LedgerService.requestPayout({
      sellerId: req.seller.id,
      amount: amountNum,
      method: payoutMethod,
      metadata: req.seller.paymentInfo || {},
      userId: req.user.userId,
      ipAddress: req.ip,
    });

    res.status(201).json(payout);
  } catch (error) {
    console.error('Erreur demande versement:', error.message);
    res.status(error.statusCode || 400).json({ error: error.message || 'Erreur lors de la demande de versement' });
  }
};

router.post('/me/payouts', requireAuth, requireSeller, handlePayoutRequest);
router.post('/me/payouts/request', requireAuth, requireSeller, handlePayoutRequest);

// GET mes versements
router.get('/me/payouts', requireAuth, requireSeller, async (req, res) => {
  try {
    const payouts = await db.sellerPayout.findMany({
      where: { sellerId: req.seller.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(payouts);
  } catch (error) {
    console.error('Erreur GET /sellers/me/payouts:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET mes revenus / statistiques avec projections du ledger
router.get('/me/earnings', requireAuth, requireSeller, async (req, res) => {
  try {
    const LedgerService = require('./services/ledger.service');
    const validWhere = {
      sellerId: req.seller.id,
      order: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    };
    const [balances, totals, orderIds] = await Promise.all([
      LedgerService.getSellerBalances(req.seller.id),
      db.orderItem.aggregate({
        where: validWhere,
        _sum: { totalPrice: true, sellerEarnings: true, quantity: true },
        _count: { _all: true },
      }),
      db.orderItem.findMany({ where: validWhere, distinct: ['orderId'], select: { orderId: true } }),
    ]);

    const totalSales = totals._sum.totalPrice || 0;
    const totalEarnings = totals._sum.sellerEarnings || 0;

    res.json({
      totalSales,
      totalEarnings,
      commissionRate: req.seller.commissionRate,
      totalOrders: orderIds.length,
      totalItemsSold: totals._sum.quantity || 0,
      totalOrderLines: totals._count._all,
      balances,
      availableBalance: balances.available,
      pendingPayoutAmount: balances.reserved,
    });
  } catch (error) {
    console.error('Erreur GET /sellers/me/earnings:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ADMIN (avant /:id) ====================

// GET tous les vendeurs (admin)
router.get('/admin/all', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};

    const sellers = await db.seller.findMany({
      where,
      include: {
        user: { select: { email: true, name: true } },
        _count: { select: { products: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(sellers.map(s => ({
      ...s,
      productCount: s._count.products
    })));
  } catch (error) {
    console.error('Erreur GET /sellers/admin/all:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET tous les payouts (admin)
router.get('/admin/payouts', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const payouts = await db.sellerPayout.findMany({
      where,
      include: { seller: { select: { storeName: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(payouts);
  } catch (error) {
    console.error('Erreur GET /sellers/admin/payouts:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/payouts/:id/process - Validation / finalisation d'un virement (MM-BE-052)
router.post('/admin/payouts/:id/process', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reference, status = 'completed' } = req.body;
    const LedgerService = require('./services/ledger.service');

    const updated = await LedgerService.updatePayoutStatus(req.params.id, status, {
      reference,
      adminUserId: req.user.userId,
      ipAddress: req.ip,
    });

    // Notifier le vendeur par email
    try {
      const sellerWithUser = await db.seller.findUnique({
        where: { id: updated.sellerId },
        include: { user: true },
      });
      if (sellerWithUser?.user?.email) {
        const emailService = require('./services/email.service');
        const sent = await emailService.sendPayoutStatusEmail(sellerWithUser, updated, status);
        if (!sent.success) console.warn('[Email] Notification payout échouée:', sent.error || 'erreur inconnue');
      }
    } catch (err) {
      console.warn('[Email] Erreur lookup vendeur pour notification payout:', err.message);
    }

    res.json({ success: true, payout: updated });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erreur traitement versement' });
  }
});

// POST /api/admin/payouts/:id/fail - Rejet et libération de la réserve (MM-BE-052)
router.post('/admin/payouts/:id/fail', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const LedgerService = require('./services/ledger.service');

    const updated = await LedgerService.updatePayoutStatus(req.params.id, 'failed', {
      reason,
      adminUserId: req.user.userId,
      ipAddress: req.ip,
    });

    // Notifier le vendeur par email du refus
    try {
      const sellerWithUser = await db.seller.findUnique({
        where: { id: updated.sellerId },
        include: { user: true },
      });
      if (sellerWithUser?.user?.email) {
        const emailService = require('./services/email.service');
        const sent = await emailService.sendPayoutStatusEmail(sellerWithUser, updated, 'rejected');
        if (!sent.success) console.warn('[Email] Notification rejet payout échouée:', sent.error || 'erreur inconnue');
      }
    } catch (err) {
      console.warn('[Email] Erreur lookup vendeur pour notification rejet payout:', err.message);
    }

    res.json({ success: true, payout: updated });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erreur rejet versement' });
  }
});

// PUT traiter un payout (admin - compatibilité)
router.put('/admin/payouts/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, reference, reason } = req.body;
    const LedgerService = require('./services/ledger.service');

    const payout = await LedgerService.updatePayoutStatus(req.params.id, status || 'completed', {
      reference,
      reason,
      adminUserId: req.user.userId,
      ipAddress: req.ip,
    });

    res.json(payout);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erreur serveur' });
  }
});

// PUT approuver/suspendre vendeur (admin)
router.put('/admin/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = approveSellerSchema.parse(req.body);

    const { status } = data;

    const seller = await db.seller.update({
      where: { id: req.params.id },
      data: {
        status: data.status,
        ...(data.commissionRate !== undefined && { commissionRate: data.commissionRate })
      },
      include: {
        user: { select: { email: true, name: true } }
      }
    });

    // Email de notification au vendeur
    try {
      const emailService = require('./services/email.service');
      if (seller.user && (status === 'approved')) {
        emailService.sendSellerApproval(seller.user.email, seller.user.name || seller.storeName, seller.storeName).catch(console.error);
      }
    } catch (emailErr) {
      console.error('[Email] Erreur notification vendeur:', emailErr.message);
    }

    res.json(seller);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Données invalides' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTE PUBLIQUE (doit être en dernier) ====================

// GET vendeur par ID (public, infos limitées)
router.get('/:id', async (req, res) => {
  try {
    const seller = await db.seller.findFirst({
      where: { id: req.params.id, status: 'approved' },
      select: {
        id: true, storeName: true, slug: true, description: true, logo: true,
        rating: true, reviewCount: true,
        _count: { select: { products: true } }
      }
    });

    if (!seller) {
      return res.status(404).json({ error: 'Vendeur non trouvé' });
    }

    res.json({
      ...seller,
      productCount: seller._count.products
    });
  } catch (error) {
    console.error('Erreur GET /sellers/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
