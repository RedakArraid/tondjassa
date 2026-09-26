'use client';

import { useState } from 'react';
import Link from 'next/link';
import BrandLogo from './BrandLogo';
import { ContactService } from '../config/api';
import { CheckCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-gray-400 hover:text-white transition-colors text-sm">
      {children}
    </Link>
  );
}

export default function PublicFooter() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await ContactService.subscribeNewsletter(email);
      setSubscribed(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-brand-navy text-white">
      {/* Bannière Newsletter */}
      <div className="border-b border-white/10 bg-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-white">Restez informé des meilleures offres MandeMarket</h3>
            <p className="text-xs text-gray-400 mt-1">
              Recevez en avant-première nos sélections exclusives de créateurs africains et nos remises.
            </p>
          </div>

          <div className="w-full md:w-auto min-w-[320px]">
            {subscribed ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-950/40 px-4 py-2.5 rounded-xl border border-emerald-800">
                <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                <span>Merci pour votre inscription à la newsletter !</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="Votre adresse email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-orange w-full"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-brand-orange hover:bg-orange-600 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 flex-shrink-0 flex items-center gap-1.5"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  {loading ? '...' : 'S’inscrire'}
                </button>
              </form>
            )}
            {!subscribed && (
              <p className="text-[11px] text-gray-400 mt-2">
                En vous inscrivant, vous acceptez de recevoir nos offres. Vous pourrez vous désinscrire à tout moment.{' '}
                <Link href="/confidentialite" className="underline hover:text-white">Confidentialité</Link>
              </p>
            )}
            {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <BrandLogo variant="dark" href="/" />
            <p className="mt-4 text-gray-400 text-sm leading-relaxed max-w-xs">
              La marketplace qui connecte l&apos;Afrique au monde.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-white">Navigation</h4>
            <ul className="space-y-2.5">
              <li><FooterLink href="/">Accueil</FooterLink></li>
              <li><FooterLink href="/boutique">Boutique</FooterLink></li>
              <li><FooterLink href="/bons-plans">Bons plans</FooterLink></li>
              <li><FooterLink href="/a-propos">À propos</FooterLink></li>
              <li><FooterLink href="/contact">Contact & Support</FooterLink></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-white">Marketplace</h4>
            <ul className="space-y-2.5">
              <li><FooterLink href="/devenir-vendeur">Devenir vendeur</FooterLink></li>
              <li><FooterLink href="/suivi">Suivi de livraison</FooterLink></li>
              <li><FooterLink href="/contact">Centre d&apos;aide</FooterLink></li>
              <li><FooterLink href="/cgv">Livraison & Tarifs</FooterLink></li>
              <li><FooterLink href="/cgv">Moyens de paiement</FooterLink></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-white">Suivez-nous</h4>
            <div className="flex gap-3">
              {['Facebook', 'X', 'Instagram', 'LinkedIn'].map((name) => (
                <a
                  key={name}
                  href="#"
                  aria-label={name}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-brand-orange flex items-center justify-center text-sm font-bold transition-colors"
                >
                  {name[0]}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm text-gray-400">
          <p>© {new Date().getFullYear()} MandeMarket. Tous droits réservés.</p>
          <div className="flex flex-wrap gap-4">
            <FooterLink href="/cgv">Conditions générales</FooterLink>
            <FooterLink href="/confidentialite">Confidentialité</FooterLink>
            <FooterLink href="/mentions-legales">Mentions légales</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
