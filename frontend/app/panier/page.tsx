'use client';

import { useState } from 'react';
import { useCart, CartItem } from '../contexts/CartContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBagIcon,
  TrashIcon,
  MinusIcon,
  PlusIcon,
  ArrowLeftIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

export default function CartPage() {
  const { items, totalItems, totalPrice, updateQuantity, removeItem, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const router = useRouter();

  const handleCheckout = () => {
    setIsProcessing(true);
    router.push('/checkout');
  };

  const handlePromoSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoMessage('Saisissez un code promo.');
      return;
    }
    sessionStorage.setItem('mm_pending_promo', code);
    setPromoCode(code);
    setPromoMessage('Code enregistré. Il sera vérifié dans le récapitulatif de paiement.');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <PublicHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <ShoppingBagIcon className="w-24 h-24 text-gray-300 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-brand-navy mb-4">Votre panier est vide</h2>
            <p className="text-gray-600 mb-6">Découvrez nos produits et remplissez votre panier !</p>
            <Link
              href="/boutique"
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3 rounded-xl hover:bg-brand-orange-dark transition-all font-bold"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Continuer vos achats
            </Link>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const priceInFCFA = Math.round(totalPrice / 100);
  const shipping = 5000;
  const totalWithShipping = priceInFCFA + shipping;

  return (
    <div className="min-h-screen bg-brand-cream">
      <PublicHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-brand-navy mb-2">Votre panier</h1>
          <p className="text-gray-600">
            {totalItems} {totalItems === 1 ? 'article' : 'articles'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Liste des articles - groupés par vendeur */}
          <div className="lg:col-span-2 space-y-4">
              {Object.entries(
                items.reduce((acc, item) => {
                  const sellerKey = item.product.seller?.id ?? 'plateforme';
                  if (!acc[sellerKey]) acc[sellerKey] = [];
                  acc[sellerKey].push(item);
                  return acc;
                }, {} as Record<string, CartItem[]>)
              ).map(([sellerKey, sellerItems]) => (
                <div key={sellerKey} className="space-y-3">
                  {sellerKey !== 'plateforme' && (
                    <p className="text-sm font-medium text-orange-600 flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full" />
                      Vendu par: {sellerItems[0]?.product.seller?.storeName || 'Vendeur'}
                    </p>
                  )}
                  {sellerItems.map((item, index) => {
                const itemPrice = Math.round(item.product.price / 100);
                const itemTotal = Math.round((item.product.price * item.quantity) / 100);
                const uniqueKey = `${item.product.id}-${item.selectedColor || 'default'}-${index}`;
                
                    return (
                      <div
                        key={uniqueKey}
                        className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
                      >
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="flex-shrink-0">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={item.product.image || `https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&h=200&fit=crop`}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&h=200&fit=crop`;
                          }}
                        />
                      </div>
                    </div>

                    {/* Détails */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <Link
                            href={`/boutique/${item.product.id}`}
                            className="text-lg font-bold text-gray-900 hover:text-orange-600 transition-colors"
                          >
                            {item.product.name}
                          </Link>
                          {item.selectedColor && (
                            <p className="text-sm text-gray-600 mt-1">
                              Couleur: <span className="font-semibold">{item.selectedColor}</span>
                            </p>
                          )}
                          <p className="text-xl font-bold text-gray-900 mt-2">
                            {itemPrice.toLocaleString()} FCFA
                          </p>
                        </div>

                        {/* Supprimer */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.product.id, item.selectedColor)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                          aria-label={`Supprimer ${item.product.name} du panier`}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Quantité */}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center border-2 border-gray-300 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedColor)}
                            disabled={item.quantity <= 1}
                            className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Diminuer la quantité de ${item.product.name}`}
                          >
                            <MinusIcon className="w-4 h-4" />
                          </button>
                          <span className="px-4 py-2 text-sm font-bold text-gray-900 min-w-[40px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedColor)}
                            disabled={item.quantity >= (item.product.stock || 0)}
                            className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Augmenter la quantité de ${item.product.name}`}
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-sm text-gray-600">Sous-total</p>
                          <p className="text-xl font-bold text-gray-900">
                            {itemTotal.toLocaleString()} FCFA
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                    );
                  })}
                </div>
              ))}

            {/* Vider le panier */}
            <div className="flex justify-end">
              <button
                onClick={clearCart}
                className="text-sm text-red-600 hover:text-red-700 hover:underline font-medium"
              >
                Vider le panier
              </button>
            </div>
          </div>

          {/* Récapitulatif */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-card p-6 border border-gray-100 sticky top-24">
              <h2 className="text-xl font-extrabold text-brand-navy mb-6">Résumé de la commande</h2>

              <div className="space-y-3 mb-5 text-sm">
                <div className="flex justify-between text-gray-700">
                  <span>Sous-total</span>
                  <span className="font-semibold">{priceInFCFA.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Livraison</span>
                  <span className="font-semibold">{shipping.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Réduction</span>
                  <span className="font-semibold">0 FCFA</span>
                </div>
                <form className="flex gap-2 pt-2" onSubmit={handlePromoSubmit}>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(event) => {
                      setPromoCode(event.target.value.toUpperCase());
                      setPromoMessage('');
                    }}
                    placeholder="Code promo"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <button type="submit" className="px-4 py-2 bg-brand-orange text-white text-sm font-bold rounded-lg hover:bg-brand-orange-dark">
                    Appliquer
                  </button>
                </form>
                {promoMessage && <p role="status" className="text-xs text-gray-600">{promoMessage}</p>}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-lg font-extrabold text-brand-navy">
                    <span>Total</span>
                    <span>{totalWithShipping.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full py-4 px-6 bg-brand-orange text-white rounded-xl font-bold text-lg hover:bg-brand-orange-dark shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CreditCardIcon className="w-6 h-6" />
                {isProcessing ? 'Traitement...' : 'Passer la commande →'}
              </button>

              <p className="mt-4 text-center text-xs text-gray-500 flex items-center justify-center gap-1">
                🔒 Paiement sécurisé · Visa · Mastercard · Mobile Money
              </p>

              <Link
                href="/boutique"
                className="block w-full mt-4 text-center text-gray-600 hover:text-brand-orange transition-colors font-medium"
              >
                <ArrowLeftIcon className="w-5 h-5 inline mr-2" />
                Continuer vos achats
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
