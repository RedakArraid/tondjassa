const db = require('../db');
const { detectRegion, resolveCountryCode, EUR_XOF_RATE } = require('../utils/region');

const SHIPPING_RATES = {
  STANDARD: {
    name: 'Livraison Standard (2-4 jours)',
    rates: {
      CI: 200000, // 2 000 FCFA
      DEFAULT: 500000, // 5 000 FCFA
      FR: 1500000, // 15 000 FCFA
    },
    freeThreshold: 5000000, // Gratuit dès 50 000 FCFA pour CI
  },
  EXPRESS: {
    name: 'Livraison Express (24-48h)',
    rates: {
      CI: 400000, // 4 000 FCFA
      DEFAULT: 800000, // 8 000 FCFA
      FR: 2500000, // 25 000 FCFA
    },
    freeThreshold: null,
  },
  PICKUP: {
    name: 'Retrait en Point Relais / Agence',
    rates: {
      CI: 0,
      DEFAULT: 0,
    },
    freeThreshold: null,
  },
};

class PricingService {
  /**
   * Calcul d'un devis immuable et déterministe
   * Unique source de vérité des prix de commande
   */
  static async calculateQuote({ items, country = 'CI', shippingMethod = 'STANDARD', promoCode = null }, tx = db) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Le panier doit contenir au moins un article');
    }

    country = resolveCountryCode(country);
    if (!country) throw new Error('Pays invalide');
    const allowed = (process.env.CHECKOUT_COUNTRIES || 'CI,FR,BE,DE,IT,ES,SN,ML,BF,TG,BJ').split(',');
    if (!allowed.includes(country)) throw new Error('Livraison indisponible pour ce pays');
    if (items.length > 100) throw new Error('Panier trop volumineux');
    const validatedItems = [];
    let subtotalAmount = 0;

    // 1. Récupération et vérification en base de chaque produit
    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);

      if (!Number.isSafeInteger(productId) || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 99) {
        throw new Error('Quantité ou identifiant de produit invalide');
      }

      const product = await tx.product.findUnique({
        where: { id: productId },
        include: {
          inventory: true,
          seller: true,
        },
      });

      if (!product) {
        throw new Error(`Produit #${productId} introuvable`);
      }

      if (product.status !== 'active') {
        throw new Error(`Le produit "${product.name}" n'est plus disponible à la vente`);
      }

      if (product.seller && product.seller.status !== 'approved') {
        throw new Error(`La boutique du produit "${product.name}" est temporairement indisponible`);
      }

      // Vérification du stock disponible (physique - réservé)
      if (product.inventory) {
        const availableStock = product.inventory.quantity - product.inventory.reserved;
        if (availableStock < quantity) {
          throw new Error(
            `Stock insuffisant pour "${product.name}". Disponible : ${availableStock}, Demandé : ${quantity}`
          );
        }
      }

      // Tarification stricte issue de la base
      const unitPrice = product.price;
      const lineTotal = unitPrice * quantity;
      subtotalAmount += lineTotal;

      const commissionRate = product.seller ? (product.seller.commissionRate ?? 10) : 10;
      const commissionAmount = Math.round((lineTotal * commissionRate) / 100);
      const sellerEarnings = lineTotal - commissionAmount;

      validatedItems.push({
        productId: product.id,
        name: product.name,
        sku: product.sku || `PROD-${product.id}`,
        image: product.image || (product.images && product.images[0]) || null,
        quantity,
        unitPrice,
        totalPrice: lineTotal,
        sellerId: product.sellerId || null,
        commissionRate,
        commissionAmount,
        sellerEarnings,
        selectedVariant: item.selectedVariant || null,
      });
    }

    // 2. Calcul des frais de livraison
    const normalizedCountry = (country || 'CI').toUpperCase();
    const selectedShippingConfig = SHIPPING_RATES[shippingMethod] || SHIPPING_RATES.STANDARD;
    let shippingCost =
      selectedShippingConfig.rates[normalizedCountry] !== undefined
        ? selectedShippingConfig.rates[normalizedCountry]
        : selectedShippingConfig.rates.DEFAULT;

    // Gratuité conditionnelle
    if (
      selectedShippingConfig.freeThreshold &&
      subtotalAmount >= selectedShippingConfig.freeThreshold &&
      normalizedCountry === 'CI'
    ) {
      shippingCost = 0;
    }

    // 3. Calcul de la promotion
    let discountAmount = 0;
    let appliedPromotion = null;

    if (promoCode && typeof promoCode === 'string' && promoCode.trim().length > 0) {
      const code = promoCode.trim().toUpperCase();
      const promotion = await tx.promotion.findUnique({
        where: { code },
      });

      const now = new Date();
      if (
        promotion &&
        promotion.isActive &&
        now >= promotion.startDate &&
        now <= promotion.endDate &&
        (promotion.maxUses === null || promotion.usedCount < promotion.maxUses) &&
        (promotion.minAmount === null || subtotalAmount >= promotion.minAmount)
      ) {
        if (promotion.type === 'PERCENTAGE') {
          discountAmount = Math.round((subtotalAmount * promotion.value) / 100);
        } else if (promotion.type === 'FIXED_AMOUNT') {
          discountAmount = Math.min(promotion.value, subtotalAmount);
        } else if (promotion.type === 'FREE_SHIPPING') {
          shippingCost = 0;
          discountAmount = 0;
        }

        appliedPromotion = {
          id: promotion.id,
          code: promotion.code,
          name: promotion.name,
          type: promotion.type,
          discountAmount,
        };
      }
    }

    // 4. Calcul de taxe (actuellement 0% par défaut)
    const taxAmount = 0;

    // 5. Total final inviolable
    const totalAmount = Math.max(0, subtotalAmount + shippingCost + taxAmount - discountAmount);

    if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0 || totalAmount > 2147483647) throw new Error('Montant de commande hors limites');
    return {
      currency: detectRegion(country) === 'europe' ? 'EUR' : 'XOF',
      exchangeRate: detectRegion(country) === 'europe' ? EUR_XOF_RATE : 1.0,
      subtotalAmount,
      shippingCost,
      taxAmount,
      discountAmount,
      totalAmount,
      items: validatedItems,
      shippingOption: {
        method: shippingMethod,
        name: selectedShippingConfig.name,
        cost: shippingCost,
      },
      appliedPromotion,
      generatedAt: new Date().toISOString(),
    };
  }

  static getShippingOptions(country = 'CI', subtotal = 0) {
    const normalizedCountry = (country || 'CI').toUpperCase();
    return Object.keys(SHIPPING_RATES).map((key) => {
      const option = SHIPPING_RATES[key];
      let cost = option.rates[normalizedCountry] ?? option.rates.DEFAULT;
      if (option.freeThreshold && subtotal >= option.freeThreshold && normalizedCountry === 'CI') {
        cost = 0;
      }
      return {
        code: key,
        name: option.name,
        cost,
      };
    });
  }
}

module.exports = PricingService;
