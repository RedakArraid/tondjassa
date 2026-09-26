'use client';

import { useState, useEffect } from 'react';
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { SellerService } from '../../config/api';
import { formatCurrency } from '../../config/analytics';

interface Seller {
  id: string;
  storeName: string;
  slug: string;
  description?: string;
  status: string;
  commissionRate: number;
  productCount?: number;
  totalSales: number;
  totalEarnings: number;
  rating: number;
  reviewCount: number;
  user?: { email: string; name?: string };
  createdAt: string;
}

export default function SellersManager({ readOnly = false }: { readOnly?: boolean }) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'suspended'>('all');
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [editCommission, setEditCommission] = useState<number>(0);
  const [savingCommission, setSavingCommission] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await SellerService.adminGetAll(filter === 'all' ? undefined : filter);
      setSellers(Array.isArray(res) ? res : res.sellers || []);
    } catch (err) {
      console.error(err);
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const handleApprove = async (id: string) => {
    try {
      await SellerService.adminApprove(id, { status: 'approved' });
      load();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      await SellerService.adminApprove(id, { status: 'suspended' });
      load();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  const openDetail = (seller: Seller) => {
    setSelectedSeller(seller);
    setEditCommission(seller.commissionRate);
  };

  const closeDetail = () => {
    setSelectedSeller(null);
  };

  const handleSaveCommission = async () => {
    if (!selectedSeller) return;
    setSavingCommission(true);
    try {
      await SellerService.adminApprove(selectedSeller.id, {
        status: selectedSeller.status as 'approved' | 'suspended',
        commissionRate: editCommission
      });
      // Refresh list and update panel
      await load();
      setSelectedSeller((prev) =>
        prev ? { ...prev, commissionRate: editCommission } : null
      );
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour de la commission');
    } finally {
      setSavingCommission(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BuildingStorefrontIcon className="w-6 h-6 text-orange-500" />
            Gestion des vendeurs
          </h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Tous</option>
            <option value="pending">En attente</option>
            <option value="approved">Approuvés</option>
            <option value="suspended">Suspendus</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600" />
          </div>
        ) : sellers.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun vendeur.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Boutique</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produits</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sellers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{s.storeName}</p>
                        <p className="text-sm text-gray-500">/{s.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{s.user?.email}</p>
                      {s.user?.name && <p className="text-xs text-gray-500">{s.user.name}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          s.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : s.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{s.productCount ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openDetail(s)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                          title="Voir détails"
                        >
                          <EyeIcon className="w-4 h-4" />
                          Voir détails
                        </button>
                        {!readOnly && s.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(s.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                              Approuver
                            </button>
                            <button
                              onClick={() => handleSuspend(s.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                            >
                              <XCircleIcon className="w-4 h-4" />
                              Refuser
                            </button>
                          </>
                        )}
                        {!readOnly && s.status === 'approved' && (
                          <button
                            onClick={() => handleSuspend(s.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                          >
                            Suspendre
                          </button>
                        )}
                        {!readOnly && s.status === 'suspended' && (
                          <button
                            onClick={() => handleApprove(s.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                          >
                            Réactiver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Backdrop */}
      {selectedSeller && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={closeDetail}
        />
      )}

      {/* Seller Detail Slide-over Panel */}
      {selectedSeller && (
        <aside className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Détails du vendeur</h2>
            <button
              type="button"
              onClick={closeDetail}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Fermer le détail du vendeur"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Store Info */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Informations boutique
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-500">Nom</p>
                <p className="font-medium text-gray-900">{selectedSeller.storeName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Slug</p>
                <p className="text-sm text-gray-700">/{selectedSeller.slug}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Statut</p>
                <span
                  className={`inline-block mt-0.5 px-2 py-0.5 text-xs font-medium rounded-full ${
                    selectedSeller.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : selectedSeller.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {selectedSeller.status}
                </span>
              </div>
              {selectedSeller.description && (
                <div>
                  <p className="text-xs text-gray-500">Description</p>
                  <p className="text-sm text-gray-700">{selectedSeller.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Owner Info */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Propriétaire
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm text-gray-900">{selectedSeller.user?.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Nom</p>
                <p className="text-sm text-gray-900">{selectedSeller.user?.name || '—'}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Statistiques
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Produits</p>
                <p className="text-xl font-bold text-gray-900">{selectedSeller.productCount ?? 0}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Note</p>
                <p className="text-xl font-bold text-gray-900">
                  {selectedSeller.rating > 0 ? `${selectedSeller.rating.toFixed(1)} ★` : 'N/A'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Ventes</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(selectedSeller.totalSales)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Gains</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(selectedSeller.totalEarnings)}
                </p>
              </div>
            </div>
          </div>

          {/* Commission Rate */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Taux de commission (%)
            </h3>
            {readOnly ? (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                {selectedSeller.commissionRate}% <span className="ml-2 text-xs font-normal text-gray-500">Lecture seule</span>
              </div>
            ) : <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={editCommission}
                onChange={(e) => setEditCommission(parseFloat(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={handleSaveCommission}
                disabled={savingCommission}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {savingCommission ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>}
          </div>

          {/* Public page link */}
          <div className="mb-6">
            <a
              href={`/vendeur/${selectedSeller.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Voir la page publique →
            </a>
          </div>

          {/* Close button */}
          <button
            onClick={closeDetail}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
        </aside>
      )}
    </>
  );
}
