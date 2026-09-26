const PricingService = require('../services/pricing.service');
const db = require('../db');

jest.mock('../db', () => ({
  product: {
    findUnique: jest.fn(),
  },
  promotion: {
    findUnique: jest.fn(),
  },
}));

describe('PricingService — Calcul de Devis Déterministe (MM-QA-090)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getShippingOptions', () => {
    it('retourne les options de livraison pour la Côte d\'Ivoire', () => {
      const options = PricingService.getShippingOptions('CI', 10000);
      expect(options).toHaveLength(3);
      const standard = options.find((o) => o.code === 'STANDARD');
      expect(standard.cost).toBe(200000); // 2 000 FCFA en centimes
    });

    it('applique la livraison gratuite si le seuil est atteint en CI', () => {
      const options = PricingService.getShippingOptions('CI', 5000000);
      const standard = options.find((o) => o.code === 'STANDARD');
      expect(standard.cost).toBe(0);
    });

    it('retourne les tarifs par défaut pour un autre pays explicitement activé', () => {
      const previous = process.env.CHECKOUT_COUNTRIES;
      process.env.CHECKOUT_COUNTRIES = 'CI,FR,BE';
      try {
        const options = PricingService.getShippingOptions('BE', 10000);
        const standard = options.find((o) => o.code === 'STANDARD');
        expect(standard.cost).toBe(500000); // 5 000 FCFA
      } finally {
        if (previous === undefined) delete process.env.CHECKOUT_COUNTRIES;
        else process.env.CHECKOUT_COUNTRIES = previous;
      }
    });

    it('refuse un pays qui n’est pas activé', () => {
      expect(() => PricingService.getShippingOptions('SN', 10000)).toThrow('Livraison indisponible');
    });
  });

  describe('calculateQuote', () => {
    it('rejette un panier vide', async () => {
      await expect(PricingService.calculateQuote({ items: [] })).rejects.toThrow(
        'Le panier doit contenir au moins un article'
      );
    });

    it('rejette un produit inexistant', async () => {
      db.product.findUnique.mockResolvedValue(null);
      await expect(
        PricingService.calculateQuote({ items: [{ productId: 999, quantity: 1 }] })
      ).rejects.toThrow('Produit #999 introuvable');
    });

    it('rejette un produit dont le statut n\'est pas active', async () => {
      db.product.findUnique.mockResolvedValue({
        id: 1,
        name: 'Tissu Bazin',
        status: 'draft',
      });
      await expect(
        PricingService.calculateQuote({ items: [{ productId: 1, quantity: 1 }] })
      ).rejects.toThrow('n\'est plus disponible à la vente');
    });

    it('rejette un produit si le stock est insuffisant', async () => {
      db.product.findUnique.mockResolvedValue({
        id: 1,
        name: 'Chaussures Cuir',
        status: 'active',
        inventory: { quantity: 5, reserved: 4 }, // 1 restant disponible
      });
      await expect(
        PricingService.calculateQuote({ items: [{ productId: 1, quantity: 2 }] })
      ).rejects.toThrow('Stock insuffisant');
    });

    it('calcule un devis valide avec commissions vendeur correctes', async () => {
      db.product.findUnique.mockResolvedValue({
        id: 10,
        name: 'Café de Côte d\'Ivoire',
        price: 500000, // 5 000 FCFA
        status: 'active',
        sellerId: 'seller-1',
        seller: { status: 'approved', commissionRate: 15 },
        inventory: { quantity: 100, reserved: 0 },
      });

      const quote = await PricingService.calculateQuote({
        items: [{ productId: 10, quantity: 2 }],
        country: 'CI',
        shippingMethod: 'STANDARD',
      });

      expect(quote.subtotalAmount).toBe(1000000); // 10 000 FCFA
      expect(quote.shippingCost).toBe(200000); // 2 000 FCFA
      expect(quote.totalAmount).toBe(1200000); // 12 000 FCFA
      expect(quote.items[0].commissionRate).toBe(15);
      expect(quote.items[0].commissionAmount).toBe(150000); // 1 500 FCFA
      expect(quote.items[0].sellerEarnings).toBe(850000); // 8 500 FCFA
    });

    it('applique correctement une promotion pourcentage', async () => {
      db.product.findUnique.mockResolvedValue({
        id: 20,
        name: 'Sac Artisan',
        price: 1000000,
        status: 'active',
        seller: { status: 'approved', commissionRate: 10 },
        inventory: { quantity: 10, reserved: 0 },
      });

      db.promotion.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'PROMO10',
        name: 'Réduction 10%',
        type: 'PERCENTAGE',
        value: 10,
        isActive: true,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        maxUses: 100,
        usedCount: 5,
        minAmount: null,
      });

      const quote = await PricingService.calculateQuote({
        items: [{ productId: 20, quantity: 1 }],
        country: 'CI',
        shippingMethod: 'STANDARD',
        promoCode: 'PROMO10',
      });

      expect(quote.subtotalAmount).toBe(1000000);
      expect(quote.discountAmount).toBe(100000); // 10% de 1 000 000
      expect(quote.shippingCost).toBe(200000);
      expect(quote.totalAmount).toBe(1000000 + 200000 - 100000); // 1 100 000
      expect(quote.appliedPromotion.code).toBe('PROMO10');
    });

    it('applique une promotion vendeur uniquement à ses lignes et recalcule ses commissions', async () => {
      db.product.findUnique
        .mockResolvedValueOnce({
          id: 31, name: 'Produit vendeur A', price: 1000000, status: 'active', sellerId: 'seller-a',
          seller: { status: 'approved', commissionRate: 10 }, inventory: { quantity: 10, reserved: 0 },
        })
        .mockResolvedValueOnce({
          id: 32, name: 'Produit vendeur B', price: 1000000, status: 'active', sellerId: 'seller-b',
          seller: { status: 'approved', commissionRate: 10 }, inventory: { quantity: 10, reserved: 0 },
        });
      db.promotion.findUnique.mockResolvedValue({
        id: 'seller-promo', sellerId: 'seller-a', code: 'SELLER20', name: 'Vendeur A -20%',
        type: 'PERCENTAGE', value: 20, isActive: true,
        startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000),
        maxUses: 100, usedCount: 0, minAmount: null,
      });
      const quote = await PricingService.calculateQuote({
        items: [{ productId: 31, quantity: 1 }, { productId: 32, quantity: 1 }],
        country: 'CI', shippingMethod: 'STANDARD', promoCode: 'SELLER20',
      });
      expect(quote.discountAmount).toBe(200000);
      expect(quote.appliedPromotion.sellerId).toBe('seller-a');
      expect(quote.items[0].commissionAmount).toBe(80000);
      expect(quote.items[0].sellerEarnings).toBe(720000);
      expect(quote.items[1].commissionAmount).toBe(100000);
      expect(quote.items[1].sellerEarnings).toBe(900000);
      expect(quote.totalAmount).toBe(2000000);
    });

    it('ignore un code promo expiré', async () => {
      db.product.findUnique.mockResolvedValue({
        id: 20,
        name: 'Sac Artisan',
        price: 1000000,
        status: 'active',
        inventory: { quantity: 10, reserved: 0 },
      });

      db.promotion.findUnique.mockResolvedValue({
        id: 'promo-expired',
        code: 'EXPIRED',
        type: 'PERCENTAGE',
        value: 20,
        isActive: true,
        startDate: new Date(Date.now() - 100000000),
        endDate: new Date(Date.now() - 1000000), // Expiré dans le passé
      });

      const quote = await PricingService.calculateQuote({
        items: [{ productId: 20, quantity: 1 }],
        country: 'CI',
        promoCode: 'EXPIRED',
      });

      expect(quote.discountAmount).toBe(0);
      expect(quote.appliedPromotion).toBeNull();
    });
  });
});
