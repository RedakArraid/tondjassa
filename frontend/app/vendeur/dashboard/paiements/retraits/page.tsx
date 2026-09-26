'use client';

import { useState, useEffect, useCallback } from 'react';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import {
  SellerPageHeader,
  SellerActionButton,
  SellerCard,
  SellerEmptyState,
} from '../../_components/ui';
import { BanknotesIcon, CreditCardIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useSellerAccess } from '../../_components/access';

function fmt(cents: number) {
  return `${Math.round((cents || 0) / 100).toLocaleString('fr-FR')} FCFA`;
}

function fmtDate(dStr: string) {
  if (!dStr) return '—';
  return new Date(dStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  pending: { label: 'En cours de validation', cls: 'bg-amber-100 text-amber-800' },
  processing: { label: 'En cours de traitement', cls: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Versé avec succès', cls: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Échec / Rejeté', cls: 'bg-rose-100 text-rose-800' },
  cancelled: { label: 'Annulé', cls: 'bg-gray-100 text-gray-700' },
};

export default function RetraitsPage() {
  const { can } = useSellerAccess();
  const canWrite = can('finance.write');
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [method, setMethod] = useState('mobile_money');
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [balRes, payRes] = await Promise.allSettled([
        SellerService.getMyBalance(),
        SellerService.getMyPayouts(),
      ]);
      if (balRes.status === 'fulfilled') setBalance(balRes.value?.balances);
      if (payRes.status === 'fulfilled') {
        setPayouts(payRes.value?.payouts || payRes.value || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const available = balance?.available ?? 0;
  const reserved = balance?.reserved ?? 0;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback({});
    const num = parseFloat(amountInput);
    const amountInCents = Math.round(num * 100);

    if (isNaN(amountInCents) || amountInCents < 500000) {
      setFeedback({ error: 'Le montant minimum pour un retrait est de 5 000 FCFA.' });
      return;
    }
    if (amountInCents > available) {
      setFeedback({ error: `Fonds insuffisants. Votre disponible est de ${fmt(available)}.` });
      return;
    }

    try {
      setSubmitting(true);
      await SellerService.requestPayout(amountInCents, method);
      setFeedback({ success: 'Demande de retrait enregistrée. Nos équipes la traitent sous 24h.' });
      setAmountInput('');
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setFeedback({ error: err.message || 'Erreur lors de la demande de versement' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Demandes de Retraits"
        description="Transférez vos gains certifiés vers votre compte Mobile Money ou compte bancaire."
        action={canWrite ? (
          <SellerActionButton
            variant="primary"
            onClick={() => {
              setFeedback({});
              setShowModal(!showModal);
            }}
          >
            {showModal ? 'Fermer le formulaire' : '+ Nouveau retrait'}
          </SellerActionButton>
        ) : undefined}
      />

      {feedback.error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {feedback.error}
        </div>
      )}
      {feedback.success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl">
          {feedback.success}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-emerald-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Solde retirable</span>
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-emerald-700 mt-2">{fmt(available)}</p>
          <p className="text-xs text-gray-400 mt-1">Disponible immédiatement sans condition</p>
        </div>

        <div className="p-5 bg-white border border-indigo-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">En cours de virement</span>
            <CreditCardIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-indigo-700 mt-2">{fmt(reserved)}</p>
          <p className="text-xs text-gray-400 mt-1">Demandes validées en cours d'acheminement</p>
        </div>
      </div>

      {/* Form modal/accordion */}
      {canWrite && showModal && (
        <SellerCard title="Initier une nouvelle demande de versement">
          <form onSubmit={handleRequest} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Moyen de réception</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Virement bancaire (IBAN / RIB)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Montant souhaité (FCFA)</label>
              <div className="relative">
                <input
                  type="number"
                  min="5000"
                  max={Math.max(0, Math.floor(available / 100))}
                  step="100"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Ex: 25000"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400">FCFA</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                <span>Minimum : 5 000 FCFA</span>
                {available > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountInput(String(Math.floor(available / 100)))}
                    className="text-orange-600 hover:underline font-medium"
                  >
                    Retirer le maximum ({fmt(available)})
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2">
              <SellerActionButton
                type="submit"
                variant="primary"
                disabled={submitting || available < 500000}
              >
                {submitting ? 'Validation...' : 'Confirmer la demande de retrait'}
              </SellerActionButton>
            </div>
          </form>
        </SellerCard>
      )}

      {/* Historique réel */}
      <SellerCard title="Historique certifié des versements">
        {payouts.length === 0 ? (
          <SellerEmptyState message="Vous n'avez effectué aucune demande de retrait pour l'instant." />
        ) : (
          <div className="divide-y divide-gray-100">
            {payouts.map((p) => {
              const badge = STATUS_BADGES[p.status] || { label: p.status, cls: 'bg-gray-100 text-gray-700' };
              return (
                <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{fmt(p.amount)}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                      <span>Initié le {fmtDate(p.createdAt)}</span>
                      <span>·</span>
                      <span className="capitalize">{p.method?.replace('_', ' ') || 'Mobile Money'}</span>
                      {p.reference && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-gray-400">Réf : {p.reference}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SellerCard>
    </div>
  );
}
