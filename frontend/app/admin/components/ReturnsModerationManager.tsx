'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { AdminService } from '../../config/api';

interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  order?: {
    id: string;
    totalAmount: number;
    status: string;
    items?: Array<{
      id: string;
      quantity: number;
      product?: { id: number; name: string; sku: string; stock: number };
      seller?: { storeName: string };
    }>;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function ReturnsModerationManager() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Rejection modal
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Refund confirmation modal
  const [refundModal, setRefundModal] = useState<ReturnRequest | null>(null);
  const [itemsReceived, setItemsReceived] = useState(false);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AdminService.getReturns(
        statusFilter === 'all' ? undefined : statusFilter,
        page,
        20
      );
      setReturns(res.returns || []);
      setPagination(res.pagination || null);
    } catch (err) {
      console.error('Erreur chargement retours:', err);
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleApprove = async (id: string) => {
    if (!confirm('Approuver cette demande de retour ? Le client sera informé de renvoyer le produit.')) return;
    setActionLoading(id);
    try {
      await AdminService.approveReturn(id);
      fetchReturns();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur approbation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal) return;
    setActionLoading(rejectModal);
    try {
      await AdminService.rejectReturn(rejectModal, rejectReason);
      setRejectModal(null);
      setRejectReason('');
      fetchReturns();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur rejet');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundSubmit = async () => {
    if (!refundModal) return;
    setActionLoading(refundModal.id);
    try {
      const result = await AdminService.processRefund(refundModal.id, itemsReceived);
      setRefundModal(null);
      fetchReturns();
      alert(result.refund?.status === 'COMPLETED' ? 'Remboursement confirme par le prestataire.' : `Demande enregistree (${result.refund?.status || 'en attente'}). Ne remboursez pas une seconde fois. Consultez le suivi des remboursements.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors du remboursement');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowUturnLeftIcon className="w-6 h-6 text-orange-600" />
            Gestion des retours et remboursements
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Validation des retours clients, réintégration du stock et inversion certifiée du ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['all', 'pending', 'approved', 'rejected', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === s
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {s === 'all'
                  ? 'Tous'
                  : s === 'pending'
                  ? 'En attente'
                  : s === 'approved'
                  ? 'Approuvés'
                  : s === 'rejected'
                  ? 'Refusés'
                  : 'Remboursés'}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchReturns()}
            disabled={loading}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
            title="Rafraîchir"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Liste des demandes */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : returns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <ArrowUturnLeftIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">Aucun retour à traiter</h3>
          <p className="text-xs text-gray-500 mt-1">
            Aucune demande de retour ne correspond aux critères sélectionnés.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {returns.map((ret) => {
            const totalFCFA = Math.round((ret.order?.totalAmount || 0) / 100);
            return (
              <div
                key={ret.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-orange-200 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-gray-900 text-base">
                        Retour #{ret.id.substring(0, 8).toUpperCase()}
                      </h4>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          ret.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : ret.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : ret.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {ret.status === 'completed'
                          ? 'Remboursé & Stock Rétabli'
                          : ret.status === 'approved'
                          ? 'Approuvé (En attente réception)'
                          : ret.status === 'rejected'
                          ? 'Refusé'
                          : 'En attente de revue'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-1">
                      Commande #{ret.orderId.substring(0, 8).toUpperCase()} · Client :{' '}
                      <span className="font-medium text-gray-700">
                        {ret.customer ? `${ret.customer.firstName} ${ret.customer.lastName}` : 'Client'}
                      </span>{' '}
                      ({ret.customer?.email}) · Soumis le {new Date(ret.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {ret.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(ret.id)}
                          disabled={actionLoading === ret.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          Approuver
                        </button>
                        <button
                          onClick={() => {
                            setRejectModal(ret.id);
                            setRejectReason('');
                          }}
                          disabled={actionLoading === ret.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <XCircleIcon className="w-4 h-4" />
                          Rejeter
                        </button>
                      </>
                    )}

                    {ret.status === 'approved' && (
                      <button
                        onClick={() => { setItemsReceived(false); setRefundModal(ret); }}
                        disabled={actionLoading === ret.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <CurrencyDollarIcon className="w-4 h-4" />
                        Rembourser & Rétablir le stock
                      </button>
                    )}
                  </div>
                </div>

                {/* Détails du retour */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-800 mb-1">Motif invoqué</p>
                    <p className="text-gray-700 font-medium">{ret.reason}</p>
                    {ret.description && (
                      <p className="text-gray-500 mt-1 italic">"{ret.description}"</p>
                    )}
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-800 mb-1">
                      Articles concernés ({totalFCFA.toLocaleString()} FCFA)
                    </p>
                    <ul className="space-y-1 text-gray-600">
                      {ret.order?.items?.map((item) => (
                        <li key={item.id} className="flex justify-between">
                          <span>
                            {item.quantity}x {item.product?.name || 'Produit'}
                          </span>
                          <span className="text-gray-400">
                            {item.seller?.storeName || 'Boutique'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-gray-500">
                Page {pagination.page} sur {pagination.pages} ({pagination.total} demandes au total)
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Rejet */}
      {rejectModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={() => setRejectModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Rejeter la demande de retour</h3>
            <p className="text-xs text-gray-500 mb-4">
              Indiquez le motif de refus pour informer le client de la décision.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Motif du refus *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex: Délai légal de rétractation dépassé, produit utilisé..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 text-xs font-medium hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === rejectModal}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                >
                  {actionLoading === rejectModal ? 'Rejet en cours...' : 'Confirmer le rejet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation Remboursement */}
      {refundModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
          onClick={() => setRefundModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-green-600 mb-3">
              <CurrencyDollarIcon className="w-8 h-8" />
              <h3 className="text-lg font-bold text-gray-900">
                Confirmer le remboursement
              </h3>
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Vous êtes sur le point d'effectuer le remboursement de{' '}
              <span className="font-bold text-gray-900">
                {Math.round((refundModal.order?.totalAmount || 0) / 100).toLocaleString()} FCFA
              </span>{' '}
              pour la commande #{refundModal.orderId.substring(0, 8).toUpperCase()}.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 mb-4">
              Le paiement ne sera marque rembourse qu'apres confirmation du prestataire.
              Un delai ou une erreur reseau conserve la demande pour reconciliation.
              Les remboursements CinetPay ou hors ligne demandent une attestation administrative.
              <label className="flex items-start gap-2 mt-3">
                <input type="checkbox" checked={itemsReceived} onChange={e => setItemsReceived(e.target.checked)} />
                Tous les articles ont ete physiquement recus et peuvent etre remis en stock.
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setRefundModal(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-xs font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRefundSubmit}
                disabled={actionLoading === refundModal.id}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-60 shadow-sm"
              >
                {actionLoading === refundModal.id ? 'Traitement...' : 'Valider le remboursement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
