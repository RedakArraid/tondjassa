'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[UI] Unhandled application error', { digest: error.digest || null });
  }, [error.digest]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16 bg-gray-50">
      <section className="w-full max-w-xl rounded-2xl bg-white border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Incident temporaire</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Cette page n’a pas pu être chargée.</h1>
        <p className="mt-3 text-sm text-gray-600">
          Vos données n’ont pas été remplacées par des données de démonstration. Vous pouvez réessayer la requête ou revenir à l’accueil.
        </p>
        {error.digest && <p className="mt-4 text-xs text-gray-400">Référence technique : {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
            Réessayer
          </button>
          <Link href="/" className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Retour à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
