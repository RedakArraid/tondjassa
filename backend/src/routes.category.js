const express = require('express');
const { z } = require('zod');
const router = express.Router();
const db = require('./db');
const { requireAuth, requireRole, optionalAuth } = require('./middleware.auth');

// 🔧 Fonction pour générer un slug à partir du nom
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^a-z0-9]+/g, '-') // Remplacer les caractères spéciaux par des tirets
    .replace(/^-+|-+$/g, ''); // Supprimer les tirets au début et à la fin
}

// Zod schema for category validation (SANS icon et image)
const categorySchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(120),
  slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(2000).optional().default(""),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  parentId: z.string().uuid().nullable().optional()
    .transform(val => val === null || val === '' ? null : val),
  displayOrder: z.number().int().min(-10000).max(10000).optional().default(0)
});

const canManageCategories = (req) => ['admin', 'manager'].includes(req.user?.role);
const publicProductWhere = {
  status: 'active',
  OR: [{ sellerId: null }, { seller: { is: { status: 'approved' } } }],
};

async function wouldCreateCategoryCycle(categoryId, parentId) {
  if (!parentId) return false;
  const visited = new Set([categoryId]);
  let current = parentId;
  for (let depth = 0; current && depth < 100; depth += 1) {
    if (visited.has(current)) return true;
    visited.add(current);
    const parent = await db.category.findUnique({ where: { id: current }, select: { parentId: true } });
    if (!parent) return false;
    current = parent.parentId;
  }
  return Boolean(current);
}

// GET all categories. Public clients only see active taxonomy entries.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const includeHierarchy = req.query.hierarchy === 'true';
    const canManage = canManageCategories(req);
    const categoryWhere = canManage ? {} : { status: 'active' };
    const productCount = canManage ? true : { where: publicProductWhere };

    if (includeHierarchy) {
      const mainCategories = await db.category.findMany({
        where: { parentId: null, ...categoryWhere },
        include: {
          subcategories: {
            where: categoryWhere,
            include: { _count: { select: { products: productCount } } },
            orderBy: { displayOrder: 'asc' },
          },
          _count: { select: { products: productCount } },
        },
        orderBy: { displayOrder: 'asc' },
      });
      return res.json(mainCategories.map((cat) => ({
        ...cat,
        productCount: cat._count.products,
        subcategories: cat.subcategories.map((sub) => ({ ...sub, productCount: sub._count.products })),
      })));
    }

    const categories = await db.category.findMany({
      where: categoryWhere,
      include: {
        parent: true,
        subcategories: { where: categoryWhere },
        _count: { select: { products: productCount } },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(categories.map((cat) => ({
      ...cat,
      parent: canManage || cat.parent?.status === 'active' ? cat.parent : null,
      productCount: cat._count.products,
    })));
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET category by id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const canManage = canManageCategories(req);
    const productFilter = canManage ? undefined : publicProductWhere;
    const category = await db.category.findUnique({
      where: { id: req.params.id },
      include: {
        products: productFilter ? { where: productFilter } : true,
        parent: true,
        subcategories: {
          where: canManage ? {} : { status: 'active' },
          include: { _count: { select: { products: canManage ? true : { where: publicProductWhere } } } },
        },
        _count: { select: { products: canManage ? true : { where: publicProductWhere } } },
      },
    });
    if (!category || (!canManage && category.status !== 'active')) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({
      ...category,
      parent: canManage || category.parent?.status === 'active' ? category.parent : null,
      productCount: category._count.products,
      subcategories: category.subcategories.map((sub) => ({ ...sub, productCount: sub._count.products })),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST create category
router.post('/', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = categorySchema.parse(req.body);
    
    // Générer le slug s'il n'est pas fourni
    if (!data.slug) {
      data.slug = generateSlug(data.name);
    }
    
    // Vérifier que le slug est unique
    const existingSlug = await db.category.findUnique({
      where: { slug: data.slug }
    });
    if (existingSlug) {
      data.slug = `${data.slug}-${Date.now()}`;
    }
    
    // Si parentId est fourni, vérifier que la catégorie parente existe
    if (data.parentId) {
      const parent = await db.category.findUnique({ where: { id: data.parentId } });
      if (!parent) return res.status(400).json({ error: 'Catégorie parente non trouvée' });
      if (data.status === 'active' && parent.status !== 'active') {
        return res.status(409).json({ error: 'Une catégorie active ne peut pas dépendre d’une catégorie inactive' });
      }
    }
    
    const category = await db.category.create({
      data: data,
      include: {
        parent: true,
        _count: {
          select: { products: true }
        }
      }
    });
    
    const categoryWithCount = {
      ...category,
      productCount: category._count.products
    };
    
    res.status(201).json(categoryWithCount);
  } catch (err) {
    console.error('Erreur création catégorie:', err);
    res.status(400).json({ error: err.errors || err.message });
  }
});

// PUT update category
router.put('/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  const id = req.params.id;
  try {
    const data = categorySchema.partial().parse(req.body);
    
    // Vérifier que la catégorie existe
    const existingCategory = await db.category.findUnique({ where: { id } });
    if (!existingCategory) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    
    // Régénérer le slug si le nom change
    if (data.name && data.name !== existingCategory.name) {
      const newSlug = generateSlug(data.name);
      const slugExists = await db.category.findFirst({
        where: {
          slug: newSlug,
          NOT: { id: id }
        }
      });
      if (slugExists) {
        data.slug = `${newSlug}-${Date.now()}`;
      } else {
        data.slug = newSlug;
      }
    }
    
    if (data.slug) {
      const slugExists = await db.category.findFirst({ where: { slug: data.slug, id: { not: id } } });
      if (slugExists) return res.status(409).json({ error: 'Ce slug de catégorie est déjà utilisé' });
    }

    const effectiveParentId = data.parentId !== undefined ? data.parentId : existingCategory.parentId;
    const effectiveStatus = data.status || existingCategory.status;
    if (effectiveParentId) {
      const parent = await db.category.findUnique({ where: { id: effectiveParentId } });
      if (!parent) return res.status(400).json({ error: 'Catégorie parente non trouvée' });
      if (await wouldCreateCategoryCycle(id, effectiveParentId)) {
        return res.status(409).json({ error: 'Cette hiérarchie créerait une boucle de catégories' });
      }
      if (effectiveStatus === 'active' && parent.status !== 'active') {
        return res.status(409).json({ error: 'Une catégorie active ne peut pas dépendre d’une catégorie inactive' });
      }
    }
    if (data.status === 'inactive') {
      const activeChildren = await db.category.count({ where: { parentId: id, status: 'active' } });
      if (activeChildren > 0) return res.status(409).json({ error: 'Désactivez d’abord les sous-catégories actives' });
    }
    
    const category = await db.category.update({
      where: { id },
      data: data,
      include: {
        parent: true,
        subcategories: true,
        _count: {
          select: { products: true }
        }
      }
    });
    
    const categoryWithCount = {
      ...category,
      productCount: category._count.products
    };
    
    res.json(categoryWithCount);
  } catch (err) {
    console.error('Erreur mise à jour catégorie:', err);
    res.status(400).json({ error: err.errors || err.message });
  }
});

// DELETE category
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = req.params.id;
  try {
    // Vérifier que la catégorie existe
    const category = await db.category.findUnique({
      where: { id },
      include: {
        subcategories: true
      }
    });
    if (!category) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    
    // Vérifier qu'il n'y a pas de sous-catégories
    if (category.subcategories.length > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer une catégorie contenant ${category.subcategories.length} sous-catégorie(s). Veuillez d'abord supprimer les sous-catégories.`
      });
    }
    
    // Vérifier qu'il n'y a pas de produits dans la catégorie
    const productsCount = await db.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer une catégorie contenant ${productsCount} produit(s). Veuillez d'abord supprimer ou déplacer les produits.`
      });
    }
    
    await db.category.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    console.error('Erreur suppression catégorie:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
  }
});

module.exports = router;
