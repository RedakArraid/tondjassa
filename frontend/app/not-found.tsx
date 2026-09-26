import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16 bg-gray-50">
      <section className="w-full max-w-xl rounded-2xl bg-white border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Page introuvable</h1>
        <p className="mt-3 text-sm text-gray-600">Le contenu demandé n’existe plus ou l’adresse est incorrecte.</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
          Revenir à l’accueil
        </Link>
      </section>
    </main>
  );
}
