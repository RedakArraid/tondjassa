'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useStore } from './contexts/StoreContext';
import PublicHeader from './components/PublicHeader';
import PublicFooter from './components/PublicFooter';
import {
  ShoppingBagIcon,
  TruckIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  GiftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  HeartIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useWishlist } from './hooks/useWishlist';
import { useCart } from './contexts/CartContext';
import { ContactService } from './config/api';

const CATEGORY_CARDS = [
  { name: 'Électronique', slug: 'electronique', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=400&fit=crop' },
  { name: 'Mode', slug: 'mode-accessoires', image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&h=400&fit=crop' },
  { name: 'Beauté', slug: 'beaute-sante', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop' },
  { name: 'Maison', slug: 'maison-decoration', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop' },
  { name: 'Alimentation', slug: 'alimentation', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop' },
  { name: 'Artisanat', slug: 'artisanat-exotique', image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop' },
  { name: 'Sport', slug: 'sport-loisirs', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop' },
];

function formatPrice(cents: number) {
  return `${Math.round(cents / 100).toLocaleString('fr-FR')} FCFA`;
}

export default function HomePage() {
  const { getActiveProducts, isHydrated } = useStore();
  const { addItem } = useCart();
  const { isInWishlist, toggle } = useWishlist();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleNewsletterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!email) return;
    setNewsletterLoading(true);
    setNewsletterMessage(null);
    try {
      await ContactService.subscribeNewsletter(email);
      setNewsletterEmail('');
      setNewsletterMessage({ type: 'success', text: 'Merci, votre inscription est confirmée !' });
    } catch (error) {
      setNewsletterMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Inscription impossible pour le moment.',
      });
    } finally {
      setNewsletterLoading(false);
    }
  };

  const products = useMemo(
    () => (isHydrated ? getActiveProducts().slice(0, 4) : []),
    [isHydrated, getActiveProducts]
  );

  const sellers = useMemo(() => {
    if (!isHydrated) return [];
    const map = new Map<string, { id: string; storeName: string; slug?: string; count: number }>();
    getActiveProducts().forEach((p: any) => {
      if (!p.seller?.id) return;
      const prev = map.get(p.seller.id);
      if (prev) prev.count += 1;
      else map.set(p.seller.id, {
        id: p.seller.id,
        storeName: p.seller.storeName || 'Boutique',
        slug: p.seller.slug,
        count: 1,
      });
    });
    return Array.from(map.values()).slice(0, 4);
  }, [isHydrated, getActiveProducts]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-brand-soft flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-orange-200 border-t-brand-orange rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-brand-navy text-xl">MandeMarket</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage: 'url(/images/brand/hero-accueil-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="absolute inset-0 bg-brand-navy/55" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center min-h-[520px] py-12 lg:py-16">
            <div className="text-white py-8 max-w-2xl animate-[fadeIn_0.7s_ease-out]">
              <span className="inline-flex items-center rounded-full bg-brand-orange px-4 py-1.5 text-sm font-semibold mb-6">
                Marketplace africaine nouvelle génération
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-5">
                Tout ce dont vous avez besoin,{' '}
                <span className="text-brand-orange">
                  livré chez vous.
                </span>
              </h1>
              <p className="text-lg text-white/90 mb-8 max-w-lg">
                Mode, électronique, alimentation, artisanat et bien plus - des milliers de produits proposés par nos vendeurs vérifiés.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/boutique"
                  className="inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3.5 rounded-xl font-bold shadow-lg hover:bg-brand-orange-dark transition-all hover:-translate-y-0.5"
                >
                  Découvrir la boutique
                  <ArrowRightIcon className="w-5 h-5" />
                </Link>
                <Link
                  href="/devenir-vendeur"
                  className="inline-flex items-center gap-2 border-2 border-white/80 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-white/10 transition-all"
                >
                  Devenir vendeur
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: TruckIcon, title: 'Livraison rapide', desc: '48h à 5-7j partout' },
            { icon: ShieldCheckIcon, title: 'Vendeurs vérifiés', desc: 'Des boutiques de confiance' },
            { icon: CreditCardIcon, title: 'Paiement sécurisé', desc: 'Mobile Money, carte bancaire' },
            { icon: GiftIcon, title: 'Produits variés', desc: 'Des milliers de références' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl border-2 border-brand-orange/30 text-brand-orange flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-brand-navy text-sm">{title}</p>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-brand-navy">Explorez nos univers</h2>
            <p className="text-gray-500 mt-2">Trouvez exactement ce que vous cherchez</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {CATEGORY_CARDS.map((cat) => (
              <Link
                key={cat.slug}
                href={`/boutique?category=${cat.slug}`}
                className="group text-center"
              >
                <div className="aspect-square rounded-2xl overflow-hidden bg-white shadow-card mb-2 ring-1 ring-black/5 group-hover:ring-brand-orange/40 transition">
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                </div>
                <span className="text-sm font-semibold text-brand-navy group-hover:text-brand-orange">{cat.name}</span>
              </Link>
            ))}
            <Link href="/boutique" className="group text-center">
              <div className="aspect-square rounded-2xl bg-brand-orange text-white flex items-center justify-center shadow-card mb-2 text-4xl font-light group-hover:bg-brand-orange-dark transition">
                +
              </div>
              <span className="text-sm font-semibold text-brand-navy">Plus</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Nouveautés */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8 gap-4">
            <h2 className="text-3xl font-extrabold text-brand-navy">Nouveautés</h2>
            <Link href="/boutique" className="text-brand-orange font-semibold text-sm inline-flex items-center gap-1 hover:underline">
              Voir toutes les nouveautés <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product: any) => (
              <div key={product.id} className="bg-white rounded-2xl shadow-card overflow-hidden group border border-gray-100">
                <div className="relative aspect-square bg-gray-50">
                  <Link href={`/boutique/${product.id}`}>
                    <img
                      src={product.image || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  </Link>
                  <span className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    Nouveau
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(Number(product.id))}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow hover:scale-105 transition"
                    aria-label="Favori"
                  >
                    {isInWishlist(Number(product.id)) ? (
                      <HeartSolid className="w-5 h-5 text-red-500" />
                    ) : (
                      <HeartIcon className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
                <div className="p-4">
                  <Link href={`/boutique/${product.id}`} className="font-semibold text-brand-navy line-clamp-1 hover:text-brand-orange">
                    {product.name}
                  </Link>
                  <p className="mt-1 font-extrabold text-brand-navy">{formatPrice(product.price)}</p>
                  <div className="mt-2 flex items-center gap-1 text-amber-400 text-xs">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <StarIcon key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                    <span className="text-gray-400 ml-1">(12)</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500 truncate max-w-[60%]">
                      {product.seller?.storeName || 'MandeMarket'}
                    </span>
                    <button
                      type="button"
                      onClick={() => addItem(product, 1)}
                      className="w-9 h-9 rounded-lg bg-brand-orange text-white flex items-center justify-center hover:bg-brand-orange-dark transition"
                      aria-label="Ajouter au panier"
                    >
                      <ShoppingBagIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p className="col-span-full text-center text-gray-500 py-12">Aucun produit pour le moment.</p>
            )}
          </div>
        </div>
      </section>

      {/* Seller CTA */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 rounded-3xl overflow-hidden shadow-card">
            <div className="relative min-h-[280px] lg:min-h-[360px]">
              <Image
                src="/images/brand/vendeur-cta.jpg"
                alt="Vendeur MandeMarket"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="bg-brand-navy text-white p-8 lg:p-12 flex flex-col justify-center">
              <p className="text-brand-orange font-bold text-sm tracking-wider mb-3">POUR LES ENTREPRENEURS</p>
              <h2 className="text-3xl font-extrabold mb-6">Vendez sur MandeMarket</h2>
              <ul className="space-y-3 mb-8">
                {[
                  'Créez votre boutique en ligne',
                  'Gérez vos commandes',
                  'Recevez vos paiements',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircleIcon className="w-5 h-5 text-brand-orange flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/devenir-vendeur"
                className="inline-flex items-center justify-center gap-2 self-start bg-brand-orange hover:bg-brand-orange-dark text-white px-6 py-3.5 rounded-xl font-bold transition"
              >
                Créer ma boutique
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Popular shops */}
      {sellers.length > 0 && (
        <section className="pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-brand-navy mb-8">Nos boutiques populaires</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {sellers.map((s) => (
                <Link
                  key={s.id}
                  href={s.slug ? `/vendeur/${s.slug}` : '/vendeur'}
                  className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:border-brand-orange/40 transition flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-orange font-bold flex items-center justify-center">
                    {s.storeName.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-brand-navy truncate">{s.storeName}</p>
                    <p className="text-xs text-gray-500">{s.count} produits · ★ 4.8</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-brand-orange px-6 py-12 md:px-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, white 0, transparent 40%), radial-gradient(circle at 80% 30%, white 0, transparent 35%)',
            }} />
            <h2 className="relative text-3xl font-extrabold text-white mb-3">Ne manquez aucune nouveauté</h2>
            <p className="relative text-white/90 mb-6">Recevez nos offres et bons plans directement par e-mail</p>
            <form
              className="relative flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
              onSubmit={handleNewsletterSubmit}
            >
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(event) => setNewsletterEmail(event.target.value)}
                placeholder="Votre adresse e-mail"
                className="flex-1 rounded-xl px-4 py-3.5 outline-none text-brand-navy"
              />
              <button
                type="submit"
                disabled={newsletterLoading}
                className="bg-brand-navy text-white font-bold px-6 py-3.5 rounded-xl hover:bg-brand-navy-light transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {newsletterLoading ? 'Inscription…' : 'S’inscrire'}
              </button>
            </form>
            {newsletterMessage && (
              <p
                role="status"
                className={`relative mt-3 text-sm font-semibold ${newsletterMessage.type === 'success' ? 'text-white' : 'text-red-100'}`}
              >
                {newsletterMessage.text}
              </p>
            )}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
