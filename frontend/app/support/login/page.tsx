'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChatBubbleLeftRightIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { apiFetch } from '../../lib/api-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

export default function SupportLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedUser = sessionStorage.getItem('admin_user');
    const token = sessionStorage.getItem('admin_token');
    if (!savedUser || !token) return;
    try {
      const user = JSON.parse(savedUser);
      if (['support', 'admin'].includes(user?.role)) router.replace('/support/dashboard');
    } catch {
      sessionStorage.removeItem('admin_user');
    }
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await apiFetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Email ou mot de passe incorrect');

      const role = data.user?.role;
      if (!['support', 'admin'].includes(role)) {
        if (role === 'seller') {
          sessionStorage.setItem('admin_token', data.token);
          sessionStorage.setItem('admin_user', JSON.stringify(data.user));
          router.push('/vendeur/dashboard');
          return;
        }
        if (role === 'manager') {
          sessionStorage.setItem('admin_token', data.token);
          sessionStorage.setItem('admin_user', JSON.stringify(data.user));
          router.push('/admin/dashboard');
          return;
        }
        throw new Error("Ce compte n'a pas accès à l'espace support");
      }

      sessionStorage.setItem('admin_token', data.token);
      sessionStorage.setItem('admin_user', JSON.stringify(data.user));
      router.push('/support/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Connexion impossible');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center text-white mb-7">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-950/30">
            <ChatBubbleLeftRightIcon className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold">Centre support</h1>
          <p className="mt-2 text-sm text-slate-300">Traitement sécurisé des demandes MandeMarket</p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8" aria-labelledby="support-login-title">
          <h2 id="support-login-title" className="text-xl font-bold">Connexion équipe support</h2>
          <p className="mt-1 text-sm text-slate-500">Réservé aux agents support et administrateurs.</p>

          {(error || searchParams?.get('error')) && (
            <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
              <span>{error || 'Votre session a expiré. Reconnectez-vous.'}</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="support-email" className="block text-sm font-semibold text-slate-700">Adresse email</label>
              <input
                id="support-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                disabled={submitting}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                placeholder="support@mandemarket.com"
              />
            </div>
            <div>
              <label htmlFor="support-password" className="block text-sm font-semibold text-slate-700">Mot de passe</label>
              <div className="relative mt-1.5">
                <LockClosedIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="support-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-12 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? 'Connexion…' : 'Accéder aux tickets'}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5 text-sm">
            <Link href="/compte/mot-de-passe-oublie" className="text-emerald-700 hover:underline">Mot de passe oublié</Link>
            <Link href="/admin/login" className="text-slate-500 hover:text-slate-800">Espace administration</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
