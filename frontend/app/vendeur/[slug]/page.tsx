'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { useRegion } from '../../contexts/RegionContext';
import { useCart } from '../../contexts/CartContext';
import { SellerService } from '../../config/api';
import {
  BuildingStorefrontIcon,
  MapPinIcon,
  StarIcon as StarOutline,
  ShareIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  TruckIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  Squares2X2Icon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&h=600&fit=crop';

const TABS = [
  { id: 'produits', label: 'Produits' },
  { id: 'apropos', label: 'À propos' },
  { id: 'avis', label: 'Avis' },
  { id: 'livraison', label: 'Politique de livraison' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) =>
        i <= Math.round(value) ? (
          <StarSolid key={i} className={`${cls} text-amber-400`} />
        ) : (
          <StarOutline key={i} className={`${cls} text-gray-300`} />
        )
      )}
    </div>
  );
}

export default function VendeurProfilPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('produits');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [sortBy, setSortBy] = useState('newest');
  const { formatPrice } = useRegion();
  const { addItem } = useCart();

  useEffect(() => {
    if (!slug) return;
    SellerService.getBySlug(slug)
      .then((data) => {
        setSeller(data);
        if (data?.storeName) {
          document.title = `${data.storeName} | MandeMarket`;
        }
      })
      .catch(() => setSeller(null))
      .finally(() => setLoading(false));
    return () => {
      document.title = 'MandeMarket';
    };
  }, [slug]);

  const products = seller?.products || [];
  const productCount = seller?.productCount ?? products.length;

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    products.forEach((p: any) => {
      if (!p.category?.id) return;
      const prev = map.get(p.category.id);
      if (prev) prev.count += 1;
      else map.set(p.category.id, { id: p.category.id, name: p.category.name, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (categoryId !== 'all') {
      list = list.filter((p: any) => p.categoryId === categoryId || p.category?.id === categoryId);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p: any) => p.name?.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'price-low':
        list.sort((a: any, b: any) => a.price - b.price);
        break;
      case 'price-high':
        list.sort((a: any, b: any) => b.price - a.price);
        break;
      case 'name':
        list.sort((a: any, b: any) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
    }
    return list;
  }, [products, categoryId, query, sortBy]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: seller?.storeName, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Lien copié !');
      }
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-cream">
        <div className="w-12 h-12 border-4 border-brand-soft border-t-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <PublicHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-brand-navy mb-2">Boutique introuvable</h1>
          <p className="text-gray-600 mb-6">Cette boutique n&apos;existe pas ou a été supprimée.</p>
          <Link href="/boutique" className="text-brand-orange hover:underline font-medium">
            Voir tous les produits →
          </Link>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const slogan =
    seller.description?.split(/[.!]/)[0]?.trim() ||
    'Qualité · Style · Confiance';
  const salesLabel = seller.totalSales
    ? `${Math.max(1, Math.round(seller.totalSales / 10000))} ventes`
    : `${productCount} produits`;

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      {/* Banner */}
      <div className="relative h-48 md:h-60 lg:h-72 overflow-hidden">
        <img
          src={DEFAULT_BANNER}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
        <p className="absolute bottom-6 right-6 md:right-12 text-white/90 font-serif italic text-lg md:text-xl drop-shadow hidden sm:block">
          Une boutique, de grandes possibilités !
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Identity — logo chevauche un peu la bannière, le nom reste sous la couverture */}
        <div className="relative mb-6 flex flex-col md:flex-row md:items-end gap-5">
          <div className="flex-shrink-0 -mt-10 md:-mt-12 z-10">
            {seller.logo ? (
              <img
                src={seller.logo}
                alt={seller.storeName}
                className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover border-4 border-white shadow-xl bg-white"
              />
            ) : (
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-brand-soft border-4 border-white shadow-xl flex items-center justify-center">
                <BuildingStorefrontIcon className="w-12 h-12 text-brand-orange" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-3 md:pt-14 md:pb-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-extrabold text-brand-navy">{seller.storeName}</h1>
                {seller.status === 'approved' && (
                  <CheckBadgeIcon className="w-7 h-7 text-sky-500" aria-label="Vendeur vérifié" />
                )}
            </div>
            <p className="text-gray-500 text-sm mb-2 line-clamp-1">{slogan}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="w-4 h-4 text-brand-orange" />
                Abidjan, Côte d&apos;Ivoire
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Stars value={seller.rating || 0} />
                <span className="font-semibold text-brand-navy">
                  {(seller.rating || 0).toFixed(1).replace('.', ',')}
                </span>
                <span className="text-gray-500">
                  ({seller.reviewCount || 0} avis) · {salesLabel}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pb-1">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-brand-navy font-semibold text-sm hover:bg-gray-50 transition"
            >
              <ShareIcon className="w-4 h-4" />
              Partager
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8 overflow-x-auto">
          <nav className="flex gap-6 min-w-max">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`pb-3 text-sm font-semibold transition border-b-2 ${
                  tab === t.id
                    ? 'border-brand-orange text-brand-orange'
                    : 'border-transparent text-gray-500 hover:text-brand-navy'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Produits tab */}
        {tab === 'produits' && (
          <div className="grid lg:grid-cols-[260px_1fr] gap-8 pb-12">
            {/* Sidebar */}
            <aside className="space-y-6">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher dans cette boutique..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                />
              </div>

              <div>
                <h3 className="font-bold text-brand-navy mb-3">Catégories</h3>
                <ul className="space-y-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => setCategoryId('all')}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        categoryId === 'all'
                          ? 'bg-brand-soft text-brand-orange'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Squares2X2Icon className="w-4 h-4" />
                      Tout voir
                    </button>
                  </li>
                  {categories.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setCategoryId(c.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                          categoryId === c.id
                            ? 'bg-brand-soft text-brand-orange'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-xs text-gray-400">{c.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            {/* Grid */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-xl font-extrabold text-brand-navy">Nos produits</h2>
                <label className="text-sm text-gray-600 flex items-center gap-2">
                  Trier par :
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-orange/30"
                  >
                    <option value="newest">Plus récents</option>
                    <option value="price-low">Prix croissant</option>
                    <option value="price-high">Prix décroissant</option>
                    <option value="name">Nom A-Z</option>
                  </select>
                </label>
              </div>

              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
                  <BuildingStorefrontIcon className="w-14 h-14 mx-auto text-gray-300 mb-3" />
                  <p>Aucun produit trouvé.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filtered.map((p: any) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-card group"
                    >
                      <Link href={`/boutique/${p.id}`} className="block aspect-square bg-gray-50 overflow-hidden">
                        <img
                          src={p.image || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400'}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      </Link>
                      <div className="p-4">
                        <Link
                          href={`/boutique/${p.id}`}
                          className="font-semibold text-brand-navy line-clamp-1 hover:text-brand-orange"
                        >
                          {p.name}
                        </Link>
                        <p className="mt-1 font-extrabold text-brand-navy">{formatPrice(p.price)}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Stars value={p.rating || 0} />
                            <span>({p.reviewCount || 0})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addItem(p, 1)}
                            className="w-9 h-9 rounded-lg bg-brand-orange text-white flex items-center justify-center hover:bg-brand-orange-dark transition"
                            aria-label="Ajouter au panier"
                          >
                            <ShoppingBagIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* À propos tab */}
        {tab === 'apropos' && (
          <div className="pb-12 max-w-3xl">
            <h2 className="text-xl font-extrabold text-brand-navy mb-4">À propos de la boutique</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
              {seller.description ||
                `${seller.storeName} propose des produits sélectionnés avec soin pour une expérience d'achat fiable et qualitative.`}
            </p>
          </div>
        )}

        {/* Avis tab */}
        {tab === 'avis' && (
          <div className="pb-12">
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-card max-w-xl">
              <div className="flex justify-center mb-3">
                <Stars value={seller.rating || 0} size="md" />
              </div>
              <p className="text-3xl font-extrabold text-brand-navy mb-1">
                {(seller.rating || 0).toFixed(1).replace('.', ',')}
              </p>
              <p className="text-gray-500">
                Basé sur {seller.reviewCount || 0} avis client{seller.reviewCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Livraison tab */}
        {tab === 'livraison' && (
          <div className="pb-12 max-w-3xl space-y-4">
            <h2 className="text-xl font-extrabold text-brand-navy">Politique de livraison</h2>
            <p className="text-gray-600 leading-relaxed">
              Les délais et frais de livraison dépendent de votre localisation et du transporteur.
              En Côte d&apos;Ivoire, comptez généralement 48h à Abidjan et 5 à 7 jours pour le reste du pays.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Pour toute question sur une commande, contactez le vendeur ou le support MandeMarket.
            </p>
          </div>
        )}

        {/* Bottom about + features (always visible like mockup) */}
        {tab === 'produits' && (
          <div className="border-t border-gray-200 py-10 mb-6">
            <div className="grid lg:grid-cols-2 gap-10 items-start">
              <div>
                <h2 className="text-lg font-extrabold text-brand-navy mb-3">À propos de la boutique</h2>
                <p className="text-gray-600 text-sm leading-relaxed line-clamp-4">
                  {seller.description ||
                    `Chez ${seller.storeName}, nous sélectionnons des produits de qualité pour vous offrir le meilleur service.`}
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: TruckIcon, label: 'Livraison rapide' },
                  { icon: ShieldCheckIcon, label: 'Produits de qualité' },
                  { icon: ChatBubbleLeftRightIcon, label: 'Service client réactif' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center text-center gap-2 p-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-soft text-brand-orange flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-brand-navy">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}
