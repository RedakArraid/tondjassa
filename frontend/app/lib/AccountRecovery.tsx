'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from './api-fetch';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
export default function AccountRecovery({ mode }: { mode: 'verify' | 'reset' | 'forgot' }) {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Opening an emailed link in an existing tab can be a same-document
    // navigation: React does not remount, so listen for the new fragment too.
    const consumeLink = () => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (!value) return;
      setToken(value);
      setPassword('');
      setMessage('');
      // Keep Next.js history state intact and remove the token from the URL.
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    };
    consumeLink();
    window.addEventListener('hashchange', consumeLink);
    return () => window.removeEventListener('hashchange', consumeLink);
  }, [mode]);
  const completing = !!token && mode !== 'forgot';
  const title = mode === 'verify' ? 'Verifier mon adresse email' : 'Recuperer mon compte';
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const endpoint = completing ? (mode === 'verify' ? 'verify-email' : 'reset-password') : (mode === 'verify' ? 'resend-verification' : 'forgot-password');
      const response = await apiFetch(`${API}/api/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(completing ? { token, newPassword: password } : { email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Operation impossible');
      setMessage(data.message || 'Mot de passe enregistre. Vous pouvez vous connecter.');
      if (completing) { setToken(''); setPassword(''); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erreur reseau'); }
    finally { setBusy(false); }
  }
  return <><PublicHeader /><main className="max-w-lg mx-auto px-6 py-16 min-h-[60vh]">
    <h1 className="text-2xl font-bold mb-4">{title}</h1>
    <p className="mb-6">{completing ? 'Choisissez votre mot de passe personnel (12 a 72 caracteres).' : 'Indiquez votre email. Consultez aussi les courriers indesirables.'}</p>
    <form onSubmit={submit} className="space-y-4">
      {completing ? <label className="block">Nouveau mot de passe<input className="block w-full border rounded p-3" required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        : <label className="block">Email<input className="block w-full border rounded p-3" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
      <button className="bg-orange-600 text-white rounded p-3" disabled={busy}>{busy ? 'En cours...' : completing ? 'Confirmer' : 'Envoyer le lien'}</button>
      <p role="status" aria-live="polite">{message}</p>
    </form><div className="mt-6 flex gap-5"><Link href="/compte/login">Connexion client</Link><Link href="/admin/login">Connexion vendeur / administration</Link></div>
  </main><PublicFooter /></>;
}
