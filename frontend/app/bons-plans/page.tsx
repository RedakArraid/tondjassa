'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { useStore } from '../contexts/StoreContext';
import { HeartIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { useWishlist } from '../hooks/useWishlist';

const DEAL_CATEGORIES = [
  { name: 'High-Tech', discount: 'Jusqu\'à -50%', image: 'https://images.unsplash.com/photo-1585515320310-259814833e87?w=600&h=400&fit=crop' },
  { name: 'Mode', discount: 'Jusqu\'à -40%', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=400&fit=crop' },
  { name: 'Maison', discount: 'Jusqu\'à -45%', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop' },
  { name: 'Alimentation', discount: 'Jusqu\'à -30%', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=400&fit=crop' },
];

const FILTERS = ['Tous', 'High-Tech', 'Mode', 'Maison', 'Alimentation', 'Beauté', 'Sport'];

const FILTER_KEYWORDS: Record<string, string[]> = {
  'High-Tech': ['electronique', 'électronique', 'informatique', 'smartphone', 'tablette'],
  Mode: ['mode', 'vetement', 'vêtement', 'sac', 'maroquinerie', 'accessoire'],
  Maison: ['maison', 'decoration', 'décoration', 'mobilier'],
  Alimentation: ['alimentation', 'boisson', 'epice', 'épice', 'naturel'],
  Beauté: ['beaute', 'beauté', 'sante', 'santé', 'cosmetique', 'cosmétique', 'karite', 'karité'],
  Sport: ['sport', 'loisir'],
};

function formatPrice(cents: number) {
  return `${Math.round(cents / 100).toLocaleString('fr-FR')} FCFA`;
}

function Countdown() {
  const [left, setLeft] = useState({ d: 2, h: 14, m: 36, s: 12 });
  useEffect(() => {
    const t = setInterval(() => {
      setLeft((prev) => {
        let { d, h, m, s } = prev;
        s -= 1;
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) { h = 23; d -= 1; }
        if (d < 0) return { d: 0, h: 0, m: 0, s: 0 };
        return { d, h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="inline-flex items-center gap-2 border-2 border-[#0B4D32] bg-[#0B4D32] text-white rounded-lg px-3 py-2 text-sm font-semibold">
      <span className="text-white/85 font-medium mr-1">Fin de l&apos;offre dans:</span>
      {[
        [left.d, 'j'],
        [left.h, 'h'],
        [left.m, 'm'],
        [left.s, 's'],
      ].map(([v, u], i) => (
        <span key={i} className="bg-[#073A26] border border-[#094A31] rounded px-2 py-1 tabular-nums">
          {pad(Number(v))} {u}
        </span>
      ))}
    </div>
  );
}

export default function BonsPlansPage() {
  const { getActiveProducts, isHydrated } = useStore();
  const [filter, setFilter] = useState('Tous');
  const { isInWishlist, toggle } = useWishlist();

  const allDeals = useMemo(() => {
    if (!isHydrated) return [];
    return getActiveProducts().slice(0, 8).map((p: any, i: number) => {
      const discount = [32, 28, 40, 25, 35, 22, 45, 18][i % 8];
      const current = p.price;
      const original = Math.round(current / (1 - discount / 100));
      return { ...p, discount, current, original };
    });
  }, [isHydrated, getActiveProducts]);

  const products = useMemo(() => {
    if (filter === 'Tous') return allDeals;
    const keywords = FILTER_KEYWORDS[filter] || [];
    return allDeals.filter((product: any) => {
      const searchable = [
        product.name,
        product.description,
        product.category?.name,
        product.category?.slug,
      ].filter(Boolean).join(' ').toLocaleLowerCase('fr');
      return keywords.some((keyword) => searchable.includes(keyword));
    });
  }, [allDeals, filter]);

  return (
    <div className="min-h-screen bg-brand-cream">
      <PublicHeader />

      {/* Hero deals */}
      <section className="relative overflow-hidden bg-brand-orange">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/images/brand/hero-bons-plans-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 relative z-10">
          <div className="flex items-center min-h-[320px] lg:min-h-[400px]">
            <div className="max-w-[33.6rem] rounded-2xl border-2 border-[#0B4D32] bg-[#0B4D32]/85 px-6 py-6 md:px-8 md:py-7 shadow-lg">
              <h1 className="text-4xl md:text-5xl font-extrabold mb-3 text-white">
                Les bons plans MandeMarket
              </h1>
              <p className="text-white text-lg mb-6 font-semibold">
                Des offres exceptionnelles, uniquement pour vous !
              </p>
              <Countdown />
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition ${
                filter === f
                  ? 'bg-brand-orange text-white'
                  : 'bg-white text-brand-navy border border-gray-200 hover:border-brand-orange'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Flash offers */}
      <section className="pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-brand-navy mb-6">Offres flash</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.slice(0, 4).map((p: any) => (
              <article key={p.id} className="bg-white rounded-2xl shadow-card overflow-hidden border border-gray-100 group">
                <div className="relative aspect-square bg-gray-50">
                  <Link href={`/boutique/${p.id}`} className="block h-full">
                    <img src={p.image || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400'} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(Number(p.id))}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
                    aria-label={isInWishlist(Number(p.id)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    {isInWishlist(Number(p.id))
                      ? <HeartSolidIcon className="w-4 h-4 text-red-500" />
                      : <HeartIcon className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
                <div className="p-4 relative">
                  <Link href={`/boutique/${p.id}`} className="font-semibold text-brand-navy line-clamp-1 hover:text-brand-orange">{p.name}</Link>
                  <p className="font-extrabold mt-1">{formatPrice(p.current)}</p>
                  <p className="text-sm text-gray-400 line-through">{formatPrice(p.original)}</p>
                  <span className="absolute bottom-4 right-4 bg-brand-orange text-white text-xs font-bold px-2 py-1 rounded">
                    -{p.discount}%
                  </span>
                </div>
              </article>
            ))}
            {products.length === 0 && (
              <p className="col-span-full rounded-2xl bg-white p-8 text-center text-gray-600">
                Aucune offre ne correspond à ce filtre pour le moment.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Best discounts */}
      <section className="pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-brand-navy">Meilleures réductions</h2>
            <Link href="/boutique" className="text-brand-orange text-sm font-semibold inline-flex items-center gap-1">
              Voir toutes les offres <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.slice(4, 8).map((p: any) => (
              <Link key={p.id} href={`/boutique/${p.id}`} className="bg-white rounded-2xl shadow-card overflow-hidden border border-gray-100 group">
                <div className="relative aspect-square bg-gray-50">
                  <img src={p.image || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400'} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                </div>
                <div className="p-4 relative">
                  <p className="font-semibold text-brand-navy line-clamp-1">{p.name}</p>
                  <p className="font-extrabold mt-1">{formatPrice(p.current)}</p>
                  <p className="text-sm text-gray-400 line-through">{formatPrice(p.original)}</p>
                  <span className="absolute bottom-4 right-4 bg-brand-orange text-white text-xs font-bold px-2 py-1 rounded">
                    -{p.discount}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-white py-10 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {[
            ['Des vrais bons plans', 'Des réductions contrôlées'],
            ['Vendeurs vérifiés', 'Boutiques de confiance'],
            ['Paiement sécurisé', 'Mobile Money & cartes'],
            ['Livraison rapide', 'Partout en Afrique de l\'Ouest'],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-bold text-brand-navy">{t}</p>
              <p className="text-sm text-gray-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category promos */}
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-brand-navy mb-8 text-center">
            Économisez plus avec nos catégories en promotion
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DEAL_CATEGORIES.map((c) => (
              <Link key={c.name} href={`/boutique?search=${encodeURIComponent(c.name)}`} className="bg-white rounded-2xl overflow-hidden shadow-card border border-gray-100 group">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={c.image} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                </div>
                <div className="p-4">
                  <p className="font-bold text-brand-navy">{c.name}</p>
                  <p className="text-brand-orange font-semibold text-sm">{c.discount}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
