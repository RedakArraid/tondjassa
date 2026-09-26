'use client';

import { useEffect, useState, useCallback } from 'react';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import {
  SellerPageHeader,
  SellerActionButton,
  SellerCard,
  SellerEmptyState,
} from '../../_components/ui';
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useSellerAccess } from '../../_components/access';

export default function StockPage() {
  const { can } = useSellerAccess();
  const canWrite = can('catalog.write');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await SellerService.getMyProducts(1, 100);
      setProducts(r?.products || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const updateStock = async (productId: number, newQty: number) => {
    if (newQty < 0) return;
    setUpdatingId(productId);
    setFeedback(null);
    try {
      await SellerService.updateProductStock(productId, newQty);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                stock: newQty,
                inventory: { ...(p.inventory || {}), quantity: newQty, available: newQty },
              }
            : p
        )
      );
      setFeedback('Stock mis à jour avec succès.');
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour du stock');
    } finally {
      setUpdatingId(null);
    }
  };

  const lowStockCount = products.filter((p) => (p.stock ?? 0) <= 5).length;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <SellerPageHeader
        title="Gestion des Stocks & Inventaire"
        description="Gérez les quantités physiques disponibles et suivez les alertes de réapprovisionnement."
        action={
          <SellerActionButton variant="primary" href="/vendeur/dashboard/produits/ajouter">
            + Ajouter un produit
          </SellerActionButton>
        }
      />

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
            {feedback}
          </span>
          <button onClick={() => setFeedback(null)} className="text-xs underline font-semibold">Fermer</button>
        </div>
      )}

      {lowStockCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs sm:text-sm text-amber-900">
            <strong>Attention :</strong> {lowStockCount} article(s) ont un stock faible (inférieur ou égal à 5 unités). Pensez à réapprovisionner rapidement.
          </div>
        </div>
      )}

      <SellerCard>
        {products.length === 0 ? (
          <SellerEmptyState
            title="Aucun produit en stock"
            description="Ajoutez des articles dans votre catalogue."
            actionLabel="+ Ajouter un produit"
            actionHref="/vendeur/dashboard/produits/ajouter"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-400 border-b">
                  <th className="pb-3 px-3">Produit</th>
                  <th className="pb-3 px-3">SKU</th>
                  <th className="pb-3 px-3 text-center">Disponible</th>
                  <th className="pb-3 px-3 text-center">Réservé</th>
                  <th className="pb-3 px-3 text-center">Stock Total</th>
                  <th className="pb-3 px-3 text-right">Ajustement rapide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => {
                  const available = p.inventory?.available ?? p.stock ?? 0;
                  const reserved = p.inventory?.reserved ?? 0;
                  const total = p.inventory?.quantity ?? p.stock ?? 0;
                  const isUpdating = updatingId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.category?.name || 'Général'}</div>
                      </td>
                      <td className="py-3 px-3 text-gray-500 font-mono text-xs">{p.sku || '—'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          available <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {available}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-gray-500">{reserved}</td>
                      <td className="py-3 px-3 text-center font-bold text-gray-900">{total}</td>
                      <td className="py-3 px-3 text-right">
                        {canWrite ? <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            disabled={isUpdating || total <= 0}
                            onClick={() => updateStock(p.id, Math.max(0, total - 1))}
                            className="w-7 h-7 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 text-xs font-bold transition"
                            title="Retirer 1"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => updateStock(p.id, total + 1)}
                            className="w-7 h-7 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 text-xs font-bold transition"
                            title="Ajouter 1"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => updateStock(p.id, total + 10)}
                            className="px-2 py-1 rounded border border-brand-orange text-brand-orange hover:bg-orange-50 disabled:opacity-40 text-xs font-semibold transition"
                            title="Ajouter 10"
                          >
                            +10
                          </button>
                          <SellerActionButton
                            size="sm"
                            variant="secondary"
                            href={`/vendeur/dashboard/produits/ajouter?id=${p.id}`}
                          >
                            Modifier
                          </SellerActionButton>
                        </div> : <span className="text-xs text-gray-400">Lecture seule</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SellerCard>
    </div>
  );
}
