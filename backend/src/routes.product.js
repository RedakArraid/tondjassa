const express = require('express');
const { z } = require('zod');
const router = express.Router();
const db = require('./db');
const { requireAuth, requireSeller, optionalAuth } = require('./middleware.auth');
const { uploadSingle, deleteImage, extractPublicId, getResponsiveUrls } = require('./services/cloudinary.service');

// Zod schema for product validation
const productSchema = z.object({
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  categoryId: z.string().min(1),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  description: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  sku: z.string().optional(),
  material: z.string().optional(),
  lining: z.string().optional(),
  coating: z.string().optional(),
  dimensions: z.string().optional(),
  weight: z.number().optional(),
  shape: z.string().optional(),
  styles: z.array(z.string()).optional(),
  pattern: z.string().optional(),
  decoration: z.string().optional(),
  closure: z.string().optional(),
  handles: z.string().optional(),
  season: z.string().optional(),
  occasion: z.string().optional(),
  features: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  gender: z.string().optional(),
  ageGroup: z.string().optional()
});

// Upload endpoint avec Cloudinary sécurisé (MM-BE-023)
router.post('/upload', requireAuth, requireProductWrite, (req, res) => {
  uploadSingle(req, res, async (err) => {
    if (err) {
      console.error('❌ Erreur upload:', err);
      return res.status(400).json({ 
        error: err.message || 'Erreur lors de l\'upload de l\'image' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image reçue.' });
    }
    
    try {
      // URL de l'image uploadée sur Cloudinary
      const imageUrl = req.file.path; // Cloudinary URL
      const publicId = req.file.filename; // Public ID Cloudinary
      
      // Générer les URLs responsives (optionnel)
      const responsiveUrls = getResponsiveUrls(publicId);
      
      console.log('✅ Image uploadée sur Cloudinary:', imageUrl);
      
      res.status(201).json({ 
        url: imageUrl,
        publicId: publicId,
        responsive: responsiveUrls
      });
    } catch (error) {
      console.error('❌ Erreur traitement upload:', error);
      res.status(500).json({ error: 'Erreur serveur lors du traitement de l\'image' });
    }
  });
});

// GET all products (with pagination, search, filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { sellerId, page = '1', limit = '24', search, categoryId, sortBy = 'newest', status } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;
    const requestedStatus = status ? String(status) : 'active';
    if (!['active', 'draft', 'archived'].includes(requestedStatus)) {
      return res.status(400).json({ error: 'Statut produit invalide' });
    }

    const where = {};
    const filters = [];
    const privileged = ['admin', 'manager'].includes(req.user?.role);
    let sellerScope = null;

    if (requestedStatus !== 'active') {
      if (privileged) {
        where.status = requestedStatus;
      } else if (req.user?.role === 'seller') {
        sellerScope = await db.seller.findUnique({
          where: { userId: req.user.userId },
          select: { id: true, status: true },
        });
        if (!sellerScope || sellerScope.status !== 'approved') {
          return res.status(403).json({ error: 'Boutique non approuvee' });
        }
        where.status = requestedStatus;
        where.sellerId = sellerScope.id;
      } else {
        return res.status(403).json({ error: 'Acces refuse' });
      }
    } else {
      where.status = 'active';
      filters.push({ category: { is: { status: 'active' } } });
      filters.push({
        OR: [
          { sellerId: null },
          { seller: { is: { status: 'approved' } } },
        ],
      });
    }

    if (sellerId) {
      const requestedSellerId = String(sellerId);
      if (sellerScope && requestedSellerId !== sellerScope.id) return res.status(403).json({ error: 'Acces refuse' });
      where.sellerId = requestedSellerId;
    }

    if (search) {
      const term = String(search).trim();
      if (term) {
        filters.push({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        });
      }
    }

    if (categoryId) {
      const allCategories = await db.category.findMany({ select: { id: true, parentId: true } });
      const descendantIds = new Set([String(categoryId)]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const category of allCategories) {
          if (category.parentId && descendantIds.has(category.parentId) && !descendantIds.has(category.id)) {
            descendantIds.add(category.id);
            changed = true;
          }
        }
      }
      where.categoryId = { in: Array.from(descendantIds) };
    }
    if (filters.length) where.AND = filters;

    const orderByMap = {
      newest: { createdAt: 'desc' },
      'price-low': { price: 'asc' },
      'price-high': { price: 'desc' },
      name: { name: 'asc' },
      popular: { createdAt: 'desc' },
    };
    const orderBy = orderByMap[sortBy] || { createdAt: 'desc' };
    const include = {
      category: { select: { id: true, name: true, slug: true, description: true, status: true } },
      seller: { select: { id: true, storeName: true, slug: true, rating: true, status: true } },
    };
    const [products, total] = await Promise.all([
      db.product.findMany({ where, include, orderBy, skip, take: limitNum }),
      db.product.count({ where }),
    ]);
    res.json({ products, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET product by id. Private catalog states stay private even if an ID is guessed.
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id)) return res.status(400).json({ error: 'ID de produit invalide' });
    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true, description: true, status: true } },
        seller: { select: { id: true, storeName: true, slug: true, rating: true, status: true } },
      },
    });
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });

    const publicVisible =
      product.status === 'active' &&
      product.category?.status === 'active' &&
      (!product.sellerId || product.seller?.status === 'approved');

    if (!publicVisible) {
      let allowed = ['admin', 'manager'].includes(req.user?.role);
      if (!allowed && req.user?.role === 'seller') {
        const seller = await db.seller.findUnique({
          where: { userId: req.user.userId },
          select: { id: true, status: true },
        });
        allowed = seller?.status === 'approved' && seller.id === product.sellerId;
      }
      if (!allowed) return res.status(404).json({ error: 'Produit non trouvé' });
    }

    res.json(product);
  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Middleware: admin/manager OU vendeur approuvé
async function requireProductWrite(req, res, next) {
  if (['admin', 'manager'].includes(req.user.role)) return next();
  if (req.user.role === 'seller') {
    return requireSeller(req, res, next);
  }
  return res.status(403).json({ error: 'Droits insuffisants pour gérer les produits.' });
}

// POST create product (admin ou vendeur)
router.post('/', requireAuth, requireProductWrite, async (req, res) => {
  try {
    const data = productSchema.parse(req.body);
    
    // Vérifier que la catégorie existe
    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      return res.status(400).json({ error: 'Catégorie non trouvée. Veuillez sélectionner une catégorie valide.' });
    }
    if ((data.status || 'active') === 'active' && category.status !== 'active') {
      return res.status(400).json({ error: 'Un produit actif doit appartenir à une catégorie active.' });
    }

    // Admin: sellerId null. Vendeur: sellerId de req.seller
    const sellerId = req.seller ? req.seller.id : null;
    const initialStock = data.stock !== undefined ? data.stock : 10;
    const generatedSku = data.sku?.trim() || `MM-${(sellerId || 'ADM').slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    
    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.create({ 
        data: {
          ...data,
          sku: generatedSku,
          stock: initialStock,
          sellerId,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true
            }
          }
        }
      });

      // Garantir l'existence atomique de la fiche d'inventaire
      await tx.inventory.create({
        data: {
          productId: p.id,
          quantity: initialStock,
          reserved: 0,
          available: initialStock,
          lowStockThreshold: 5,
        },
      });

      return p;
    });
    
    res.status(201).json(product);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Le code SKU existe déjà pour cette boutique' });
    }
    console.error('Erreur création produit:', err);
    if (err.errors) {
      res.status(400).json({ error: 'Données invalides', details: err.errors });
    } else {
      res.status(400).json({ error: err.message || 'Erreur lors de la création du produit' });
    }
  }
});

// PUT update product (admin ou propriétaire vendeur)
router.put('/:id', requireAuth, requireProductWrite, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID de produit invalide' });
  }
  
  try {
    const data = productSchema.partial().parse(req.body);
    
    // Vérifier que le produit existe
    const existingProduct = await db.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Vendeur: ne peut modifier que ses propres produits
    if (req.seller && existingProduct.sellerId !== req.seller.id) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres produits.' });
    }
    
    const effectiveCategoryId = data.categoryId || existingProduct.categoryId;
    const effectiveStatus = data.status || existingProduct.status;
    const targetCategory = await db.category.findUnique({ where: { id: effectiveCategoryId } });
    if (!targetCategory) {
      return res.status(400).json({ error: 'Catégorie non trouvée. Veuillez sélectionner une catégorie valide.' });
    }
    if (effectiveStatus === 'active' && targetCategory.status !== 'active') {
      return res.status(400).json({ error: 'Un produit actif doit appartenir à une catégorie active.' });
    }

    const oldPublicId = data.image && data.image !== existingProduct.image &&
      existingProduct.image?.includes('cloudinary')
      ? extractPublicId(existingProduct.image)
      : null;

    const product = await require('./services/transaction').transaction(async (tx) => {
      const { stock, ...fields } = data;
      if (stock !== undefined) await require('./services/inventory.service').setPhysical(tx, id, stock);
      return tx.product.update({ where: { id }, data: fields,
        include: { category: { select: { id: true, name: true, slug: true, description: true } } } });
    });

    if (oldPublicId) {
      try {
        await deleteImage(oldPublicId);
      } catch (error) {
        console.warn('Ancienne image Cloudinary non supprimée après mise à jour:', error.message);
      }
    }
    res.json(product);
  } catch (err) {
    console.error('Erreur mise à jour produit:', err);
    if (err.errors) {
      res.status(400).json({ error: 'Données invalides', details: err.errors });
    } else {
      res.status(400).json({ error: err.message || 'Erreur lors de la mise à jour du produit' });
    }
  }
});

// DELETE product (admin ou propriétaire vendeur)
router.delete('/:id', requireAuth, requireProductWrite, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID de produit invalide' });
  }
  
  try {
    // Récupérer le produit pour obtenir l'image
    const product = await db.product.findUnique({ where: { id } });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Vendeur: ne peut supprimer que ses propres produits
    if (req.seller && product.sellerId !== req.seller.id) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres produits.' });
    }
    
    // Vérifier si le produit est dans des commandes en cours
    const ordersCount = await db.orderItem.count({ 
      where: { productId: id } 
    });
    
    if (ordersCount > 0) {
      // Plutôt que supprimer, on désactive le produit
      await db.product.update({
        where: { id },
        data: { status: 'archived' }
      });
      
      return res.status(200).json({ 
        message: 'Le produit a été archivé car il apparaît dans des commandes historiques.',
        action: 'deactivated'
      });
    }
    
    const publicId = product.image?.includes('cloudinary') ? extractPublicId(product.image) : null;

    // Inventory and reviews cascade from Product. SQL commits before remote
    // media cleanup so an external failure cannot leave half-deleted database state.
    await require('./services/transaction').transaction((tx) => tx.product.delete({ where: { id } }));

    if (publicId) {
      try {
        await deleteImage(publicId);
      } catch (error) {
        console.warn('Produit supprimé mais média Cloudinary orphelin à nettoyer:', error.message);
      }
    }

    res.status(204).end();
  } catch (err) {
    console.error('Erreur suppression produit:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

module.exports = router; 