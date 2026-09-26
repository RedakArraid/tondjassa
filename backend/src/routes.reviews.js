const express = require('express');
const { z } = require('zod');
const router = express.Router();
const db = require('./db');
const { optionalAuth } = require('./middleware.auth');
const ReviewService = require('./services/review.service');

// Zod schema pour validation
const reviewSchema = z.object({
  productId: z.number().int().positive(),
  customerName: z.string().trim().min(1).max(100).optional(),
  customerEmail: z.string().trim().email().optional().or(z.literal('')),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(150).optional(),
  comment: z.string().trim().min(1).max(5000),
});

// GET /api/reviews/:productId - Récupérer tous les avis d'un produit
router.get('/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const reviews = await db.review.findMany({
      where: {
        productId: productId,
        status: 'approved', // Seulement les avis approuvés
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ reviews });
  } catch (error) {
    console.error('Erreur lors de la récupération des avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/reviews - Créer un nouvel avis (MM-BE-071)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const data = reviewSchema.parse(req.body);
    const result = await ReviewService.createReview(db, data, req.user || null);
    res.status(201).json(result);
  } catch (error) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Données invalides', details: error.errors });
    }
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Vous avez déjà évalué ce produit.' });
    }
    const status = error?.statusCode || 500;
    if (status >= 500) console.error('Erreur lors de la création de l\'avis:', error);
    res.status(status).json({ error: status >= 500 ? 'Erreur serveur' : error.message });
  }
});

// PUT /api/reviews/:id/helpful - Marquer un avis comme utile
router.put('/:id/helpful', async (req, res) => {
  try {
    const reviewId = req.params.id;

    const review = await db.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }

    const updatedReview = await db.review.update({
      where: { id: reviewId },
      data: { helpful: review.helpful + 1 },
    });

    res.json({ review: updatedReview });
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/reviews/:productId/stats - Statistiques des avis d'un produit
router.get('/:productId/stats', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const reviews = await db.review.findMany({
      where: {
        productId: productId,
        status: 'approved',
      },
    });

    const stats = {
      total: reviews.length,
      averageRating: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0,
      ratingDistribution: {
        5: reviews.filter(r => r.rating === 5).length,
        4: reviews.filter(r => r.rating === 4).length,
        3: reviews.filter(r => r.rating === 3).length,
        2: reviews.filter(r => r.rating === 2).length,
        1: reviews.filter(r => r.rating === 1).length,
      },
    };

    res.json({ stats });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

