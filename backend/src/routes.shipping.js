const express = require('express');
const { requireAuth, requireRole } = require('./middleware.auth');
const { detectRegion, EUR_XOF_RATE } = require('./utils/region');
const router = express.Router();
const boxtal = require('./services/boxtal.service');
const db = require('./db');

// Tarifs livraison Afrique (en centimes XOF)
const AFRICA_SHIPPING_OPTIONS = [
  {
    id: 'abidjan',
    label: 'Livraison Abidjan',
    detail: '48-72h',
    carrier: 'LOCAL_ABIDJAN',
    costXof: 0,
    costDisplay: 'Gratuit',
    zone: ['CI'],
  },
  {
    id: 'ci_national',
    label: 'Livraison Côte d\'Ivoire (autres villes)',
    detail: '3-5 jours ouvrés',
    carrier: 'CI_NATIONAL',
    costXof: 200000, // 2 000 FCFA
    costDisplay: '2 000 FCFA',
    zone: ['CI'],
  },
  {
    id: 'uemoa',
    label: 'Zone UEMOA (SN, ML, BF, TG, BJ, NE, GN...)',
    detail: '5-7 jours ouvrés',
    carrier: 'UEMOA_REGIONAL',
    costXof: 500000, // 5 000 FCFA
    costDisplay: '5 000 FCFA',
    zone: ['SN','ML','BF','TG','BJ','NE','GN','GW'],
  },
  {
    id: 'africa_other',
    label: 'Autres pays d\'Afrique',
    detail: '7-14 jours ouvrés',
    carrier: 'AFRICA_INTERNATIONAL',
    costXof: 800000, // 8 000 FCFA
    costDisplay: '8 000 FCFA',
    zone: [],
  },
];

// Tarifs livraison Europe (eurCents + conversion XOF pour la DB)
const EUROPE_SHIPPING_OPTIONS = [
  {
    id: 'eu_relais',
    label: 'Point Relais (Mondial Relay / Pickup)',
    detail: '4-6 jours ouvrés',
    carrier: 'POINT_RELAIS',
    eurCents: 499,
    costDisplay: '4,99 €',
  },
  {
    id: 'eu_standard',
    label: 'La Poste — Colissimo standard',
    detail: '3-5 jours ouvrés',
    carrier: 'COLISSIMO',
    eurCents: 699,
    costDisplay: '6,99 €',
  },
  {
    id: 'eu_suivi',
    label: 'Colissimo — Suivi à domicile',
    detail: '2-4 jours ouvrés',
    carrier: 'COLISSIMO_SUIVI',
    eurCents: 899,
    costDisplay: '8,99 €',
  },
  {
    id: 'eu_chronopost',
    label: 'Chronopost — Express',
    detail: '1-2 jours ouvrés',
    carrier: 'CHRONOPOST',
    eurCents: 1499,
    costDisplay: '14,99 €',
  },
];

// GET /api/shipping/options?country=CI
// Retourne les options de livraison selon la région du pays de destination
router.get('/options', (req, res) => {
  const country = req.query.country || 'CI';
  const region = detectRegion(country);

  if (region === 'europe') {
    const options = EUROPE_SHIPPING_OPTIONS.map(o => ({
      ...o,
      costXof: Math.round((o.eurCents / 100) * EUR_XOF_RATE * 100),
    }));
    return res.json({ region, currency: 'EUR', options });
  }

  return res.json({ region, currency: 'XOF', options: AFRICA_SHIPPING_OPTIONS });
});

// POST /api/shipping/rates - Tarifs Boxtal (Europe uniquement)
router.post('/rates', async (req, res) => {
  try {
    const { weight, width, height, depth, deliveryCountry } = req.body;
    const region = detectRegion(deliveryCountry || 'CI');

    if (region === 'africa') {
      return res.json({ region: 'africa', options: AFRICA_SHIPPING_OPTIONS });
    }

    // Europe → Boxtal
    const rates = await boxtal.getShippingRates({ weight, width, height, depth, deliveryCountry });
    res.json({ region: 'europe', ...rates });
  } catch (err) {
    console.error('[Shipping] Erreur tarifs:', err.message);
    res.json({ region: 'europe', options: EUROPE_SHIPPING_OPTIONS });
  }
});

// GET /api/shipping/track/:trackingNumber
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const shipping = await db.shipping.findFirst({
      where: { trackingCode: req.params.trackingNumber },
      include: { order: { select: { status: true, createdAt: true } } },
    });
    if (!shipping) return res.status(404).json({ error: 'Numéro de suivi non trouvé' });
    res.json({
      trackingCode: shipping.trackingCode,
      status: shipping.status,
      carrier: shipping.carrier,
      estimatedDelivery: shipping.estimatedDelivery,
      actualDelivery: shipping.actualDelivery,
      orderStatus: shipping.order?.status,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Legacy endpoint must not simulate a shipment or bypass the stock state machine.
router.post('/create/:orderId', requireAuth, requireRole(['admin', 'seller']), (_req, res) => {
  res.status(409).json({ error: 'Utilisez le parcours expedition de la commande et un numero de suivi reel. La creation automatique d etiquette est desactivee.' });
});
module.exports = router;
