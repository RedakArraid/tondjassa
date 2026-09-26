'use client';

import { apiFetch as fetch } from '../../lib/api-fetch';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import {
  EnvelopeIcon,
  LockClosedIcon,
  ExclamationCircleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useCustomerAuth();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [error, setError]               = useState<string | null>(null);
  const [staffPortal, setStaffPortal] = useState<'admin' | 'support' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('passwordChanged') === '1') {
      setNotice('Mot de passe modifié. Toutes les anciennes sessions ont été déconnectées ; reconnectez-vous.');
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/compte/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStaffPortal(null);
    setIsSubmitting(true);

    try {
      // 1. Essayer le login client
      await login(email, password);
      router.push('/compte/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de connexion';
      const isWrongPortal =
        msg.includes('admin/login') ||
        msg.includes('admin, manager') ||
        msg.includes('pas un compte client');

      if (isWrongPortal) {
        // 2. Fallback : essayer le login vendeur/admin
        try {
          const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();

          if (res.ok && data.token) {
            if (data.user?.role === 'seller') {
              // Vendeur → connecter et rediriger vers son dashboard
              sessionStorage.setItem('admin_token', data.token);
              sessionStorage.setItem('admin_user', JSON.stringify(data.user));
              router.push('/vendeur/dashboard');
            } else if (data.user?.role === 'support') {
              sessionStorage.setItem('admin_token', data.token);
              sessionStorage.setItem('admin_user', JSON.stringify(data.user));
              router.push('/support/dashboard');
            } else {
              // Admin / manager → ce portail n'est pas fait pour eux
              setStaffPortal('admin');
            }
          } else {
            setError(data.error || 'Email ou mot de passe incorrect');
          }
        } catch {
          setError('Impossible de joindre le serveur');
        }
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
        <PublicHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
      <PublicHeader />

      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <LockClosedIcon className="w-8 h-8 text-orange-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Connexion</h1>
              <p className="text-gray-500 mt-1 text-sm">Clients &amp; vendeurs</p>
            </div>

            {notice && (
              <div role="status" className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4 text-sm font-medium text-green-800">
                {notice}
              </div>
            )}

            {/* Erreur admin uniquement */}
            {staffPortal && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <ShieldExclamationIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">Compte professionnel détecté</p>
                  <p className="text-sm text-amber-700 mb-3">
                    Ce compte dispose d&apos;un espace dédié.
                  </p>
                  <Link
                    href={staffPortal === 'support' ? '/support/login' : '/admin/login'}
                    className="inline-flex items-center gap-2 bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Accéder à l&apos;espace {staffPortal === 'support' ? 'support' : 'admin'} →
                  </Link>
                </div>
              </div>
            )}

            {/* Erreur générique */}
            {error && (
              <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Adresse email
                </label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    required
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    required
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form><div className="mt-4 text-sm flex gap-4"><a href="/compte/mot-de-passe-oublie">Mot de passe oublie</a><a href="/compte/verifier-email">Verifier mon email</a></div>

            <p className="text-center text-sm text-gray-500 mt-6">
              Pas encore de compte ?{' '}
              <Link href="/compte/register" className="text-orange-600 font-semibold hover:text-orange-700 transition-colors">
                S'inscrire
              </Link>
            </p>

            <div className="mt-5 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400 mb-1">Vous êtes administrateur ou manager ?</p>
              <Link
                href="/admin/login"
                className="text-sm text-gray-500 hover:text-orange-600 font-medium transition-colors"
              >
                Espace administration →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
