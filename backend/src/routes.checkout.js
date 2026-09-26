const express = require('express');
const { z } = require('zod');
const router = express.Router();
const PricingService = require('./services/pricing.service');

const quoteSchema = z.object({
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().max(99),
      variantId: z.string().optional(),
    })
  ).min(1, 'Le panier ne peut pas être vide'),
  country: z.string().min(2).max(3).optional().default('CI'),
  shippingMethod: z.enum(['STANDARD', 'EXPRESS', 'PICKUP']).optional().default('STANDARD'),
  promoCode: z.string().max(30).optional().nullable(),
});

// POST /api/checkout/quote — Aperçu officiel et infalsifiable du devis
router.post('/quote', async (req, res) => {
  try {
    const data = quoteSchema.parse(req.body);
    const quote = await PricingService.calculateQuote(data);
    res.json(quote);
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({ error: 'Données invalides', details: err.errors });
    }
    res.status(400).json({ error: err.message || 'Erreur lors du calcul du devis' });
  }
});

// GET /api/checkout/shipping-options — Options de livraison disponibles
router.get('/shipping-options', (req, res) => {
  try {
    const country = req.query.country || 'CI';
    const subtotal = parseInt(req.query.subtotal, 10) || 0;
    const options = PricingService.getShippingOptions(country, subtotal);
    res.json({ options });
  } catch (err) {
    res.status(422).json({ error: err.message || 'Livraison indisponible pour ce pays' });
  }
});

module.exports = router;
