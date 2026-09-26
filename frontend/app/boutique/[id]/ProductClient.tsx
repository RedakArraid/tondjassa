'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../contexts/CartContext';
import { useRegion } from '../../contexts/RegionContext';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import ProductReviews from '../../components/ProductReviews';
import Link from 'next/link';
import {
  ShoppingBagIcon, SparklesIcon, TruckIcon, ShieldCheckIcon,
  CreditCardIcon, ArrowLeftIcon, CheckIcon, MinusIcon, PlusIcon,
  HeartIcon, ShareIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { useWishlist } from '../../hooks/useWishlist';

type TabType = 'description' | 'specifications' | 'reviews';

interface Props {
  initialProduct: any;
  similarProducts: any[];
}

export default function ProductClient({ initialProduct, similarProducts }: Props) {
  const router = useRouter();
  const { addItem } = useCart();
  const { formatPrice, t } = useRegion();
  const { isInWishlist, toggle } = useWishlist();

  const product = initialProduct;

  const [selectedColor, setSelectedColor]         = useState<string | null>(null);
  const [quantity, setQuantity]                   = useState(1);
  const [selectedImage, setSelectedImage]         = useState<string | null>(
    product?.image || (product?.images?.[0] ?? null)
  );
  const [imageZoom, setImageZoom]                 = useState(false);
  const [activeTab, setActiveTab]                 = useState<TabType>('description');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const maxQuantity    = product?.stock || 0;
  const isFavorite = isInWishlist(Number(product?.id));
  const availableColors = product?.colors || [];
  const isNew = product
    ? new Date().getTime() - new Date(product.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
    : false;

  // Galerie combinée image principale + galerie
  const allImages: string[] = [];
  if (product?.image) allImages.push(product.image);
  (product?.images || []).forEach((img: string) => {
    if (img && !allImages.includes(img)) allImages.push(img);
  });

  const handleAddToCart = () => {
    if (!product || maxQuantity === 0) return;
    addItem(product, quantity, selectedColor || undefined);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleQuantityChange = (delta: number) => {
    const next = quantity + delta;
    if (next >= 1 && next <= maxQuantity) setQuantity(next);
  };

  const handleShare = async () => {
    if (navigator.share && product) {
      try {
        await navigator.share({ title: product.name, text: product.description, url: window.location.href });
      } catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
        <PublicHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Produit non trouvé</h2>
            <p className="text-gray-600 mb-6">Ce produit n&apos;existe pas ou a été retiré.</p>
            <Link href="/boutique" className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all font-bold">
              <ArrowLeftIcon className="w-5 h-5" />
              Retour à la boutique
            </Link>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
      <PublicHeader />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <Link href="/" className="hover:text-orange-600 transition-colors">Accueil</Link>
            <span>/</span>
            <Link href="/boutique" className="hover:text-orange-600 transition-colors">Boutique</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Toast succès */}
      {showSuccessMessage && (
        <div className="fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <CheckIcon className="w-5 h-5" />
          <span className="font-bold">{t('product.addedToCart')}</span>
        </div>
      )}

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

          {/* ── Images ── */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200 group">
              <button
                type="button"
                onClick={() => setImageZoom(true)}
                className="block h-full w-full cursor-zoom-in"
                aria-label={`Agrandir l’image de ${product.name}`}
              >
                <img
                  src={selectedImage || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=800&fit=crop'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                  onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=800&fit=crop'; }}
                />
              </button>

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                {isNew && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-full text-xs font-bold shadow-lg">
                    <SparklesIcon className="w-3 h-3" /> Nouveau
                  </span>
                )}
                {maxQuantity > 0 && maxQuantity <= 5 && (
                  <span className="px-3 py-1.5 bg-red-500 text-white rounded-full text-xs font-bold shadow-lg">
                    Dernières pièces
                  </span>
                )}
              </div>

              <div className="absolute top-4 right-4 z-10">
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                  maxQuantity > 10 ? 'bg-green-500 text-white' :
                  maxQuantity > 5  ? 'bg-yellow-500 text-white' :
                  maxQuantity > 0  ? 'bg-red-500 text-white' :
                  'bg-gray-500 text-white'
                }`}>
                  {maxQuantity > 0 ? `${maxQuantity} en stock` : 'Rupture de stock'}
                </span>
              </div>

              <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                <button
                  type="button"
                  onClick={() => toggle(Number(product.id))}
                  className={`p-3 rounded-full backdrop-blur-sm transition-all shadow-lg ${isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-900 hover:bg-white'}`}
                  aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  {isFavorite ? <HeartIconSolid className="w-5 h-5" /> : <HeartIcon className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-3 bg-white/90 text-gray-900 rounded-full backdrop-blur-sm hover:bg-white transition-all shadow-lg"
                  aria-label="Partager ce produit"
                  title="Partager"
                >
                  <ShareIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {allImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedImage === img ? 'border-orange-500 shadow-lg scale-105' : 'border-gray-200 hover:border-orange-300'}`}
                    aria-label={`Afficher l’image ${idx + 1} de ${product.name}`}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Détails ── */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm font-bold text-orange-600 uppercase tracking-wide">
                  {product.category?.name || 'Non catégorisé'}
                </span>
                {product.sku && <span className="text-sm text-gray-500">SKU: {product.sku}</span>}
                {product.seller?.slug && (
                  <Link href={`/vendeur/${product.seller.slug}`} className="text-sm text-gray-500 hover:text-orange-600">
                    {t('product.seller')} {product.seller.storeName}
                  </Link>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{product.name}</h1>
              <div className="flex items-baseline gap-4 mb-6">
                <span className="text-4xl font-bold text-gray-900">{formatPrice(product.price)}</span>
                <span className="text-sm text-gray-500">{t('product.priceLabel')}</span>
              </div>
            </div>

            {/* Couleur */}
            {availableColors.length > 0 && (
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  {t('product.color')}{selectedColor && `: ${selectedColor}`}
                </label>
                <div className="flex flex-wrap gap-3">
                  {availableColors.map((color: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${selectedColor === color ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantité */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">{t('product.quantity')}</label>
              <div className="flex items-center gap-4">
                <div className="flex items-center border-2 border-gray-300 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1} className="p-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label="Diminuer la quantité">
                    <MinusIcon className="w-5 h-5" />
                  </button>
                  <span className="px-6 py-3 text-lg font-bold text-gray-900 min-w-[60px] text-center">{quantity}</span>
                  <button type="button" onClick={() => handleQuantityChange(1)} disabled={quantity >= maxQuantity} className="p-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label="Augmenter la quantité">
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
                <span className="text-sm text-gray-600">
                  {maxQuantity > 0 ? `${maxQuantity} ${t('shop.inStock')}` : t('shop.outOfStock')}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
              <button
                onClick={handleAddToCart}
                disabled={maxQuantity === 0}
                className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  maxQuantity === 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl hover:scale-105'
                }`}
              >
                <ShoppingBagIcon className="w-6 h-6" />
                {maxQuantity === 0 ? t('shop.unavailable') : t('shop.addToCart')}
              </button>
              <button
                onClick={() => { handleAddToCart(); router.push('/panier'); }}
                disabled={maxQuantity === 0}
                className="w-full py-4 px-6 rounded-xl font-bold text-lg border-2 border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('shop.buyNow')}
              </button>
            </div>

            {/* Garanties */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-gray-200">
              {[
                { icon: TruckIcon,       label: t('product.guarantee.delivery'),  desc: t('product.guarantee.deliveryDesc') },
                { icon: ShieldCheckIcon, label: t('product.guarantee.quality'),   desc: t('product.guarantee.qualityDesc') },
                { icon: CreditCardIcon,  label: t('product.guarantee.payment'),   desc: t('product.guarantee.paymentDesc') },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Icon className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{label}</h3>
                    <p className="text-sm text-gray-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Onglets ── */}
        <div className="mt-12 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(['description', 'specifications', 'reviews'] as TabType[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 px-6 text-center font-bold transition-colors ${
                    activeTab === tab
                      ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                      : 'text-gray-600 hover:text-orange-600 hover:bg-gray-50'
                  }`}
                >
                  {t(`product.tab.${tab === 'specifications' ? 'specs' : tab}`)}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'description' && (
              <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-line">{product.description}</p>
            )}

            {activeTab === 'specifications' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  ['Matériau', product.material],
                  ['Dimensions', product.dimensions],
                  ['Poids', product.weight ? `${product.weight} kg` : null],
                  ['Forme', product.shape],
                  ['Fermeture', product.closure],
                  ['Poignées', product.handles],
                  ['Doublure', product.lining],
                  ['Revêtement', product.coating],
                  ['Motif', product.pattern],
                  ['Décoration', product.decoration],
                  ['Saison', product.season],
                  ['Occasion', product.occasion],
                  ['Genre', product.gender],
                  ["Tranche d'âge", product.ageGroup],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string}>
                    <span className="text-sm font-semibold text-gray-500">{label}</span>
                    <p className="text-lg font-bold text-gray-900">{value}</p>
                  </div>
                ))}

                {product.styles?.length > 0 && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <span className="text-sm font-semibold text-gray-500">Styles</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {product.styles.map((s: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {product.features?.length > 0 && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <span className="text-sm font-semibold text-gray-500">Caractéristiques</span>
                    <ul className="mt-2 space-y-2">
                      {product.features.map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-gray-700">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && typeof product.id === 'number' && (
              <ProductReviews productId={product.id} />
            )}
          </div>
        </div>

        {/* ── Produits similaires ── */}
        {similarProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('product.similar')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarProducts.map((p) => (
                <Link
                  key={p.id}
                  href={`/boutique/${p.id}`}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 group border border-gray-100"
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={p.image || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop'}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop'; }}
                    />
                    <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                        (p.stock || 0) > 10 ? 'bg-green-500 text-white' :
                        (p.stock || 0) > 0  ? 'bg-yellow-500 text-white' :
                        'bg-gray-500 text-white'
                      }`}>
                        {(p.stock || 0) > 0 ? p.stock : 'Rupture'}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">{p.category?.name}</span>
                    <h3 className="text-lg font-bold text-gray-900 mt-2 mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">{p.name}</h3>
                    <div className="text-xl font-bold text-gray-900">{formatPrice(p.price)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <PublicFooter />

      {/* Modal Zoom */}
      {imageZoom && selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setImageZoom(false)}>
          <button type="button" onClick={() => setImageZoom(false)} className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors" aria-label="Fermer l’aperçu agrandi">
            <XMarkIcon className="w-8 h-8" />
          </button>
          <img
            src={selectedImage}
            alt={product.name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
