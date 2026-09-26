'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProductService, SellerService } from '../../../config/api';
import { Spinner } from '../_components/sections';
import {
  SellerPageHeader,
  SellerHeaderActions,
  SellerActionButton,
  SellerCard,
  SellerEmptyState,
  FilterChips,
  RowActions,
} from '../_components/ui';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useSellerAccess } from '../_components/access';

function fmt(cents: number) {
  return `${Math.round((cents || 0) / 100).toLocaleString('fr-FR')} FCFA`;
}

const FILTERS = ['Tous', 'Actifs', 'Brouillons', 'Rupture de stock'];

export default function TousLesProduitsPage() {
  const { can } = useSellerAccess();
  const canWrite = can('catalog.write');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [filter, setFilter] = useState('Tous');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const sku = String(p.sku || '').toLowerCase();
      if (q && !name.includes(q.toLowerCase()) && !sku.includes(q.toLowerCase())) return false;
      if (filter === 'Actifs') return p.status === 'active';
      if (filter === 'Brouillons') return p.status !== 'active';
      if (filter === 'Rupture de stock') return (p.stock ?? 0) === 0;
      return true;
    });
  }, [products, filter, q]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      await SellerService.downloadProductsCsv();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’export');
    } finally {
      setExporting(false);
    }
  };

  const handleBulk = async (action: 'activate' | 'deactivate' | 'archive' | 'delete') => {
    if (selected.size === 0) return;
    if (action === 'delete' && !confirm(`Supprimer définitivement ${selected.size} produit(s) ?`)) return;

    try {
      setLoading(true);
      const res = await SellerService.bulkProductsAction(action, Array.from(selected));
      setActionMessage(res?.message || 'Opération réussie');
      setSelected(new Set());
      await load();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’action groupée');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      setLoading(true);
      await SellerService.duplicateProduct(id);
      setActionMessage('Produit dupliqué avec succès (créé en brouillon).');
      await load();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la duplication');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'draft' : 'active';
    try {
      setLoading(true);
      await SellerService.updateProductStatus(id, nextStatus);
      await load();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return;
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
        title="Tous les produits"
        description="Gérez votre catalogue, vos prix et vos stocks en temps réel."
        action={
          <SellerHeaderActions>
            <SellerActionButton href="/vendeur/dashboard/produits/ajouter" variant="primary">
              + Ajouter un produit
            </SellerActionButton>
            <SellerActionButton variant="outline" onClick={handleExportCsv} disabled={exporting}>
              <span className="flex items-center gap-1.5">
                <ArrowDownTrayIcon className="w-4 h-4" />
                {exporting ? 'Exportation...' : 'Exporter CSV'}
              </span>
            </SellerActionButton>
          </SellerHeaderActions>
        }
      />

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs font-semibold text-emerald-900 underline">Fermer</button>
        </div>
      )}

      <SellerCard>
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par nom ou référence SKU..."
              className="w-full lg:max-w-md px-4 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
            />
            <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
          </div>

          {canWrite && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
              <span className="text-xs font-semibold text-orange-950 mr-2">{selected.size} sélectionné(s)</span>
              <SellerActionButton size="sm" variant="primary" onClick={() => handleBulk('activate')}>
                Activer
              </SellerActionButton>
              <SellerActionButton size="sm" variant="secondary" onClick={() => handleBulk('deactivate')}>
                Désactiver
              </SellerActionButton>
              <SellerActionButton size="sm" variant="outline" onClick={() => handleBulk('archive')}>
                Archiver
              </SellerActionButton>
              <SellerActionButton size="sm" variant="danger" onClick={() => handleBulk('delete')}>
                Supprimer
              </SellerActionButton>
            </div>
          )}

          {filtered.length === 0 ? (
            <SellerEmptyState
              title="Aucun produit trouvé"
              description="Ajoutez votre premier article pour commencer à vendre."
              actionLabel="+ Ajouter un produit"
              actionHref="/vendeur/dashboard/produits/ajouter"
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 pb-1 border-b">
                {canWrite && <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={selectAll}
                />}
                <span>{canWrite ? 'Tout sélectionner' : 'Catalogue'} ({filtered.length} produits)</span>
              </div>

              {filtered.map((p) => {
                const isActive = p.status === 'active';
                return (
                  <div
                    key={p.id}
                    className="border border-gray-100 hover:border-gray-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center gap-4 justify-between transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {canWrite && <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="mt-2 rounded"
                      />}
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-14 h-14 rounded-lg object-cover border shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400 shrink-0">
                          Sans image
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-brand-navy truncate">{p.name}</p>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {isActive ? 'Actif' : 'Brouillon'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {fmt(p.price)} · Stock : <strong className={p.stock <= 5 ? 'text-amber-600' : 'text-gray-700'}>{p.stock ?? 0}</strong> · SKU : {p.sku || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <RowActions>
                      <SellerActionButton size="sm" variant="secondary" href={`/boutique/${p.id}`}>
                        Aperçu
                      </SellerActionButton>
                      <SellerActionButton size="sm" variant="primary" href={`/vendeur/dashboard/produits/ajouter?id=${p.id}`}>
                        Modifier
                      </SellerActionButton>
                      <SellerActionButton permission="catalog.write" size="sm" variant="outline" onClick={() => handleDuplicate(p.id)}>
                        Dupliquer
                      </SellerActionButton>
                      <SellerActionButton permission="catalog.write"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggleStatus(p.id, p.status)}
                      >
                        {isActive ? 'Désactiver' : 'Activer'}
                      </SellerActionButton>
                      <SellerActionButton permission="catalog.write" size="sm" variant="danger" onClick={() => handleDelete(p.id)}>
                        Supprimer
                      </SellerActionButton>
                    </RowActions>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SellerCard>
    </div>
  );
}
