'use client';

import { useState, useEffect } from 'react';
import { BanknotesIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { SellerService } from '../../config/api';

interface Payout {
  id: string;
  amount: number;
  status: string;
  sellerId: string;
  seller?: { storeName: string; slug: string };
  reference?: string;
  createdAt: string;
}

export default function PayoutsManager() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed'>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await SellerService.adminGetPayouts(filter === 'all' ? undefined : filter);
      setPayouts(Array.isArray(res) ? res : res.payouts || []);
    } catch (err) {
      console.error(err);
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const handleProcessing = async (id: string) => {
    setUpdating(id);
    try {
      await SellerService.adminUpdatePayout(id, { status: 'processing' });
      await load();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Erreur'); }
    finally { setUpdating(null); }
  };

  const handleComplete = async (id: string, reference?: string) => {
    setUpdating(id);
    try {
      await SellerService.adminUpdatePayout(id, { status: 'completed', reference });
      load();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = async (id: string) => {
    setUpdating(id);
    try {
      await SellerService.adminUpdatePayout(id, { status: 'failed' });
      load();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <BanknotesIcon className="w-6 h-6 text-orange-500" />
          Versements vendeurs
        </h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">Tous</option>
          <option value="pending">En attente</option><option value="processing">En traitement</option>
          <option value="completed">Effectués</option>
          <option value="failed">Refusés</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600" />
        </div>
      ) : payouts.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Aucun versement.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendeur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.seller?.storeName || '-'}</p>
                    <p className="text-sm text-gray-500">/{p.seller?.slug}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {(Number(p.amount) / 100).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        p.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : p.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.reference && (
                      <p className="text-xs text-gray-500 mt-1">Réf: {p.reference}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['pending', 'processing'].includes(p.status) && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            if (p.status === 'pending') { handleProcessing(p.id); return; }
                            const ref = window.prompt('Reference obligatoire du virement effectivement realise');
                            if (ref && ref.trim().length >= 6) handleComplete(p.id, ref.trim());
                          }}
                          disabled={!!updating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          {updating === p.id ? '...' : p.status === 'pending' ? 'Prendre en charge' : 'Confirmer le versement'}
                        </button>
                        <button
                          onClick={() => handleReject(p.id)}
                          disabled={!!updating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                        >
                          <XCircleIcon className="w-4 h-4" />
                          Refuser
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
