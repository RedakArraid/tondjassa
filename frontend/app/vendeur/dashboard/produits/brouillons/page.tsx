'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProductService, SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import {
  SellerPageHeader,
  SellerActionButton,
  SellerCard,
  SellerEmptyState,
  RowActions,
} from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

export default function BrouillonsPage() {
  const { can } = useSellerAccess();
  const canWrite = can('catalog.write');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await SellerService.getMyProducts(1, 50, { status: 'draft' });
      setProducts(r?.products || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handlePublish = async (id: number) => {
    try {
      setLoading(true);
      await SellerService.updateProductStatus(id, 'active');
      await load();
    } catch (e: any) {
      alert(e.message || 'Erreur publication');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      setLoading(true);
      await SellerService.duplicateProduct(id);
      await load();
    } catch (e: any) {
      alert(e.message || 'Erreur duplication');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer définitivement ce brouillon ?')) return;
    try {
      await ProductService.delete(String(id));
      await load();
    } catch (e: any) {
      alert(e.message || 'Erreur suppression');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <SellerPageHeader
        title="Brouillons & Fiches en attente"
        description="Fiches produits en cours de rédaction, non visibles sur la boutique publique."
        action={
          <SellerActionButton href="/vendeur/dashboard/produits/ajouter" variant="primary">
            + Nouveau brouillon
          </SellerActionButton>
        }
      />
      <SellerCard>
        {products.length === 0 ? (
          <SellerEmptyState
            title="Aucun brouillon"
            description="Toutes vos fiches produits sont actuellement publiées et en ligne."
            actionLabel="+ Créer un produit"
            actionHref="/vendeur/dashboard/produits/ajouter"
          />
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition"
              >
                <div>
                  <p className="font-semibold text-brand-navy">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Modifié le {new Date(p.updatedAt).toLocaleDateString('fr-FR')} · SKU : {p.sku || 'N/A'} · Prix : {(p.price / 100).toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                {canWrite && <RowActions>
                  <SellerActionButton
                    size="sm"
                    variant="primary"
                    href={`/vendeur/dashboard/produits/ajouter?id=${p.id}`}
                  >
                    Éditer
                  </SellerActionButton>
                  <SellerActionButton
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePublish(p.id)}
                  >
                    Publier
                  </SellerActionButton>
                  <SellerActionButton
                    size="sm"
                    variant="outline"
                    onClick={() => handleDuplicate(p.id)}
                  >
                    Dupliquer
                  </SellerActionButton>
                  <SellerActionButton
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(p.id)}
                  >
                    Supprimer
                  </SellerActionButton>
                </RowActions>}
              </div>
            ))}
          </div>
        )}
      </SellerCard>
    </div>
  );
}
