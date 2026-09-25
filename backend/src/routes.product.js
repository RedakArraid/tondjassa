const express = require('express');
const { z } = require('zod');
const router = express.Router();
const db = require('./db');
const { requireAuth, requireAdmin, requireRole, requireSeller } = require('./middleware.auth');
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
router.get('/', async (req, res) => {
  try {
    const {
      sellerId,
      page = '1',
      limit = '24',
      search,
      categoryId,
      sortBy = 'newest',
      status,
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip     = (pageNum - 1) * limitNum;

    const where = {};
    if (sellerId)   where.sellerId   = sellerId;
    // Public endpoint: only show active products unless status is explicitly requested
    where.status = status || 'active';

    if (search) {
      const term = search.trim();
      where.OR = [
        { name:        { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      // Collect category + all descendant IDs for hierarchical filtering
      const allCategories = await db.category.findMany({ select: { id: true, parentId: true } });
      const descendantIds = new Set([categoryId]);
      let changed = true;
      while (changed) {
        changed = false;
        allCategories.forEach(c => {
          if (c.parentId && descendantIds.has(c.parentId) && !descendantIds.has(c.id)) {
            descendantIds.add(c.id);
            changed = true;
          }
        });
      }
      where.categoryId = { in: Array.from(descendantIds) };
    }

    const orderByMap = {
      newest:     { createdAt: 'desc' },
      'price-low':  { price: 'asc' },
      'price-high': { price: 'desc' },
      name:       { name: 'asc' },
      popular:    { createdAt: 'desc' }, // fallback; real popularity needs orderCount
    };
    const orderBy = orderByMap[sortBy] || { createdAt: 'desc' };

    const include = {
      category: { select: { id: true, name: true, slug: true, description: true } },
      seller:   { select: { id: true, storeName: true, slug: true, rating: true } },
    };

    const [products, total] = await Promise.all([
      db.product.findMany({ where, include, orderBy, skip, take: limitNum }),
      db.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        page:       pageNum,
        limit:      limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET product by id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }
    
    const product = await db.product.findUnique({ 
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true
          }
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            rating: true
          }
        }
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
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
    
    // Si on change la catégorie, vérifier qu'elle existe
    if (data.categoryId && data.categoryId !== existingProduct.categoryId) {
      const category = await db.category.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        return res.status(400).json({ error: 'Catégorie non trouvée. Veuillez sélectionner une catégorie valide.' });
      }
    }
    
    // Si on change l'image, supprimer l'ancienne de Cloudinary
    if (data.image && data.image !== existingProduct.image) {
      if (existingProduct.image && existingProduct.image.includes('cloudinary')) {
        const oldPublicId = extractPublicId(existingProduct.image);
        if (oldPublicId) {
          try {
            await deleteImage(oldPublicId);
            console.log('✅ Ancienne image supprimée de Cloudinary');
          } catch (error) {
            console.error('⚠️ Erreur suppression ancienne image:', error);
            // On continue quand même la mise à jour
          }
        }
      }
    }
    
    const product = await require('./services/transaction').transaction(async (tx) => {
      const { stock, ...fields } = data;
      if (stock !== undefined) await require('./services/inventory.service').setPhysical(tx, id, stock);
      return tx.product.update({ where: { id }, data: fields,
        include: { category: { select: { id: true, name: true, slug: true, description: true } } } });
    });

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
        message: 'Le produit a été désactivé car il apparaît dans des commandes. Vous pouvez le supprimer manuellement depuis la base de données si nécessaire.',
        action: 'deactivated'
      });
    }
    
    // Supprimer l'image de Cloudinary si elle existe
    if (product.image && product.image.includes('cloudinary')) {
      const publicId = extractPublicId(product.image);
      if (publicId) {
        try {
          await deleteImage(publicId);
          console.log('✅ Image supprimée de Cloudinary lors de la suppression du produit');
        } catch (error) {
          console.error('⚠️ Erreur suppression image Cloudinary:', error);
          // On continue quand même la suppression du produit
        }
      }
    }
    
    // Supprimer l'inventaire associé (si existe)
    try {
      await db.inventory.deleteMany({ where: { productId: id } });
      console.log(`✅ Inventaire du produit ${id} supprimé`);
    } catch (error) {
      console.error('⚠️ Erreur suppression inventaire:', error);
      // On continue quand même
    }
    
    // Supprimer le produit
    await db.product.delete({ where: { id } });
    console.log(`✅ Produit ${id} supprimé avec succès`);
    res.status(204).end();
  } catch (err) {
    console.error('Erreur suppression produit:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

module.exports = router; 