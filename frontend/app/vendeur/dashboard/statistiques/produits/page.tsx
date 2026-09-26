'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard, SellerStatGrid } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

function fmt(cents: number) {
  return `${Math.round((cents || 0) / 100).toLocaleString('fr-FR')} FCFA`;
}

export default function StatistiquesProduitsPage() {
  const { can } = useSellerAccess();
  const canWrite = can('catalog.write');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    SellerService.getMyProducts({ limit: 100 })
      .then((data) => {
        setProducts(data?.products || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const activeProducts = products.filter((p) => p.status === 'active');
  const lowStock = products.filter((p) => (p.stock ?? 0) <= 5);
  const draftProducts = products.filter((p) => p.status === 'draft');
  const outOfStock = products.filter((p) => (p.stock ?? 0) === 0);

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Statistiques des produits"
        description="Suivez l'état des stocks et la répartition réelle de votre catalogue."
        action={
          <div className="flex items-center gap-2">
            {canWrite && <Link
              href="/vendeur/dashboard/produits/stock"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition"
            >
              Ajuster les stocks
            </Link>}
            <Link
              href="/vendeur/dashboard/produits/ajouter"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm transition"
            >
              + Nouveau produit
            </Link>
          </div>
        }
      />

      <SellerStatGrid
        items={[
          { label: 'Catalogue total', value: String(products.length), hint: 'Toutes références confondues' },
          { label: 'Produits en ligne', value: String(activeProducts.length), hint: 'Visibles par les acheteurs' },
          { label: 'Stock faible', value: String(lowStock.length), hint: 'Stock <= 5 unités' },
          { label: 'Rupture de stock', value: String(outOfStock.length), hint: 'À réapprovisionner' },
          { label: 'Brouillons', value: String(draftProducts.length), hint: 'Non publiés' },
        ]}
      />

      <SellerCard title="Aperçu du catalogue">
        <div className="divide-y divide-gray-100">
          {products.slice(0, 10).map((p) => (
            <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {p.image ? (
                  <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover border" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs">📦</div>
                )}
                <div>
                  <p className="font-semibold text-sm text-brand-navy truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    Prix : {fmt(p.price)} · Stock :{' '}
                    <span className={p.stock <= 5 ? 'text-amber-600 font-bold' : 'text-gray-700'}>
                      {p.stock ?? 0} unités
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canWrite && <Link
                  href={`/vendeur/dashboard/produits/ajouter?id=${p.id}`}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                >
                  Modifier
                </Link>}
                {canWrite && <Link
                  href="/vendeur/dashboard/produits/stock"
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition"
                >
                  Stock
                </Link>}
              </div>
            </div>
          ))}
        </div>
      </SellerCard>
    </div>
  );
}
