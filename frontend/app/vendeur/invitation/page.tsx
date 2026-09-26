'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch as fetch } from '../../lib/api-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

type State = 'loading' | 'login' | 'accepting' | 'success' | 'error';

export default function SellerInvitationPage() {
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const acceptInvitation = useCallback(async (invitationToken: string, accessToken: string) => {
    setState('accepting');
    setMessage('');
    const response = await fetch(`${API_URL}/api/sellers/invitations/${invitationToken}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        setState('login');
        setMessage('Connectez-vous avec l’adresse qui a reçu l’invitation.');
        return;
      }
      throw new Error(data.error || 'Impossible d’accepter cette invitation.');
    }
    sessionStorage.setItem('admin_token', data.accessToken || accessToken);
    if (data.user) sessionStorage.setItem('admin_user', JSON.stringify(data.user));
    window.history.replaceState(null, '', window.location.pathname);
    setState('success');
    setMessage(`Invitation acceptée. Votre rôle ${data.role || 'collaborateur'} est maintenant actif.`);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await Promise.resolve();
      const invitationToken = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
      if (!/^[a-f0-9]{64}$/.test(invitationToken)) {
        setState('error');
        setMessage('Ce lien d’invitation est invalide ou incomplet.');
        return;
      }
      setToken(invitationToken);
      const accessToken = sessionStorage.getItem('admin_token') || sessionStorage.getItem('mandemarket_customer_token');
      if (!accessToken) {
        setState('login');
        setMessage('Connectez-vous avec l’adresse qui a reçu l’invitation.');
        return;
      }
      try {
        await acceptInvitation(invitationToken, accessToken);
      } catch (error) {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Impossible d’accepter cette invitation.');
      }
    };
    void initialize();
  }, [acceptInvitation]);

  const loginAndAccept = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('accepting');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.token) throw new Error(data.error || 'Identifiants invalides.');
      await acceptInvitation(token, data.token);
    } catch (error) {
      setState('login');
      setMessage(error instanceof Error ? error.message : 'Connexion impossible.');
    }
  };

  return (
    <main className="min-h-screen bg-orange-50/40 flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-8 shadow-lg">
        <p className="text-sm font-bold text-orange-600">MandeMarket</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Invitation vendeur</h1>

        {(state === 'loading' || state === 'accepting') && (
          <div role="status" className="mt-8 flex items-center gap-3 text-gray-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            {state === 'loading' ? 'Vérification du lien…' : 'Activation de votre accès…'}
          </div>
        )}

        {state === 'login' && (
          <form onSubmit={loginAndAccept} className="mt-6 space-y-4">
            {message && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
            <div>
              <label htmlFor="invitation-email" className="mb-1 block text-sm font-medium text-gray-700">Adresse email invitée</label>
              <input id="invitation-email" type="email" required autoComplete="email" value={email}
                onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </div>
            <div>
              <label htmlFor="invitation-password" className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
              <input id="invitation-password" type="password" required autoComplete="current-password" value={password}
                onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </div>
            <button type="submit" className="w-full rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700">
              Se connecter et accepter
            </button>
            <p className="text-center text-sm text-gray-500">
              Pas encore de compte ? <Link href="/compte/register" className="font-semibold text-orange-600 hover:underline">Créer un compte</Link>, puis revenez au lien reçu.
            </p>
          </form>
        )}

        {state === 'success' && (
          <div className="mt-6">
            <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>
            <button type="button" onClick={() => router.push('/vendeur/dashboard')}
              className="mt-5 w-full rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700">
              Ouvrir le tableau de bord
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="mt-6">
            <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{message}</p>
            <Link href="/" className="mt-5 inline-block text-sm font-semibold text-orange-600 hover:underline">Retour à l’accueil</Link>
          </div>
        )}
      </section>
    </main>
  );
}
