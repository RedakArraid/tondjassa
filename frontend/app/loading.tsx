export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite" className="min-h-[50vh] flex items-center justify-center px-6">
      <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-orange-600" aria-hidden="true" />
        Chargement…
      </div>
    </main>
  );
}
