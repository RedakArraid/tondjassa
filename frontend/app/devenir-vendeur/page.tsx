'use client';

import { apiFetch as fetch } from '../lib/api-fetch';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  UsersIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

const BENEFITS = [
  { icon: CurrencyDollarIcon, title: 'Gagnez de l\'argent', desc: 'Vendez vos produits à des milliers de clients en Afrique et en Europe.' },
  { icon: UsersIcon,          title: 'Large audience',     desc: 'Accédez instantanément à notre base de clients existants.' },
  { icon: GlobeAltIcon,       title: 'Multi-devise',       desc: 'Recevez des paiements en FCFA ou en EUR selon votre région.' },
  { icon: ShieldCheckIcon,    title: 'Sécurisé',           desc: 'Paiements sécurisés, reversements rapides, support dédié.' },
];

export default function DevenirVendeurPage() {
  const router = useRouter();
  const [step, setStep] = useState<'landing' | 'form' | 'success'>('landing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name:        '',
    email:       '',
    password:    '',
    storeName:   '',
    description: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 12) { setError('Le mot de passe doit faire au moins 12 caractères.'); return; }
    if (form.storeName.trim().length < 2) { setError('Le nom de boutique doit faire au moins 2 caractères.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/signup-seller`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:        form.name,
          email:       form.email,
          password:    form.password,
          storeName:   form.storeName,
          description: form.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Une erreur est survenue.'); return; }

      // Store token so seller can access dashboard directly
      if (data.verificationRequired) { window.location.href = '/compte/verifier-email'; return; }
      if (data.token) {
        localStorage.setItem('admin_token', data.token);
        if (data.user) localStorage.setItem('admin_user', JSON.stringify(data.user));
      }
      setStep('success');
    } catch {
      setError('Impossible de contacter le serveur. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Inscription envoyée !</h1>
          <p className="text-gray-600 mb-8">
            Votre boutique <strong className="text-gray-900">{form.storeName}</strong> est en attente de validation.
            Vous recevrez une confirmation par email sous 24-48h.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/vendeur/dashboard"
              className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              Accéder au tableau de bord
            </Link>
            <Link
              href="/boutique"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Voir la boutique
            </Link>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      {/* Hero */}
      <section className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full mb-6">
            <BuildingStorefrontIcon className="w-5 h-5" />
            <span className="font-semibold text-sm">Programme Vendeur</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Vendez sur MandeMarket</h1>
          <p className="text-xl text-orange-100 max-w-2xl mx-auto mb-8">
            Rejoignez notre marketplace et atteignez des milliers de clients en Afrique de l'Ouest et en Europe.
          </p>
          {step === 'landing' && (
            <button
              onClick={() => setStep('form')}
              className="px-8 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-lg text-lg"
            >
              Créer ma boutique gratuitement
            </button>
          )}
        </div>
      </section>

      {/* Avantages */}
      {step === 'landing' && (
        <>
          <section className="max-w-5xl mx-auto px-4 py-16">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Pourquoi vendre sur MandeMarket ?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {BENEFITS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white rounded-2xl p-6 shadow border border-gray-100 flex gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
                    <p className="text-sm text-gray-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Comment ça marche */}
          <section className="bg-white py-16">
            <div className="max-w-4xl mx-auto px-4">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Comment ça marche ?</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { num: '1', title: 'Créez votre compte',    desc: 'Remplissez le formulaire avec vos informations et celles de votre boutique.' },
                  { num: '2', title: 'Validation en 24-48h',  desc: 'Notre équipe valide votre boutique et vous envoie une confirmation par email.' },
                  { num: '3', title: 'Commencez à vendre',    desc: 'Ajoutez vos produits et recevez vos premières commandes.' },
                ].map(({ num, title, desc }) => (
                  <div key={num} className="text-center">
                    <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">{num}</div>
                    <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-600">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="text-center mt-10">
                <button
                  onClick={() => setStep('form')}
                  className="px-8 py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg text-lg"
                >
                  Commencer maintenant
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Formulaire d'inscription */}
      {step === 'form' && (
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BuildingStorefrontIcon className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Créer votre boutique</h2>
              <p className="text-gray-600 text-sm mt-2">Déjà vendeur ? <Link href="/compte/login" className="text-orange-600 hover:underline font-medium">Connectez-vous</Link></p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Votre nom complet</label>
                <input
                  type="text" name="name" value={form.name} onChange={handleChange}
                  placeholder="Aminata Koné"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email *</label>
                <input
                  type="email" name="email" value={form.email} onChange={handleChange} required
                  placeholder="email@exemple.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mot de passe * <span className="font-normal text-gray-400">(12 caractères min.)</span></label>
                <input
                  type="password" name="password" value={form.password} onChange={handleChange} required minLength={12}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>

              <hr className="border-gray-100" />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nom de la boutique *</label>
                <input
                  type="text" name="storeName" value={form.storeName} onChange={handleChange} required
                  placeholder="Ma Belle Boutique"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description de la boutique <span className="font-normal text-gray-400">(optionnel)</span></label>
                <textarea
                  name="description" value={form.description} onChange={handleChange}
                  rows={3}
                  placeholder="Décrivez votre boutique en quelques mots..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Création en cours...' : 'Créer ma boutique'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                En créant un compte vous acceptez nos{' '}
                <Link href="/cgv" className="text-orange-600 hover:underline">conditions générales</Link>.
              </p>
            </form>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
