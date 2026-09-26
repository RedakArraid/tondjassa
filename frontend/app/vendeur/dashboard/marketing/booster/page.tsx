'use client';

import React, { useEffect, useState } from 'react';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

export default function BoosterPage() {
  const { can } = useSellerAccess();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [boostType, setBoostType] = useState<'product' | 'store'>('product');
  const [durationDays, setDurationDays] = useState('7');
  const [budget, setBudget] = useState('15000');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    SellerService.getMyProducts({ limit: 100 })
      .then((data) => {
        const list = data?.products || [];
        setProducts(list);
        if (list.length > 0) {
          setSelectedProductId(String(list[0].id));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleRequestBoost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const subject = boostType === 'product'
        ? `Demande de Boost Produit #${selectedProductId} (${durationDays} jours)`
        : `Demande de Boost Boutique (${durationDays} jours)`;

      const msg = `Type de boost : ${boostType === 'product' ? 'Mise en avant Produit' : 'Mise en avant Boutique entière'}\n` +
        `Produit ID : ${boostType === 'product' ? selectedProductId : 'N/A'}\n` +
        `Durée souhaitée : ${durationDays} jours\n` +
        `Budget alloué : ${Number(budget).toLocaleString('fr-FR')} FCFA\n` +
        `Précisions : ${message || 'Aucune'}`;

      await SellerService.createSupportTicket({
        category: 'Marketing',
        subject,
        message: msg,
      });

      setFeedback({
        type: 'success',
        message: 'Votre demande de boost a été transmise avec succès à l’équipe marketing MandeMarket. Nous vous contacterons pour valider le positionnement et le règlement.',
      });
      setMessage('');
    } catch (err: any) {
      console.error('Erreur demande boost:', err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la soumission de la demande.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!can('orders.write')) {
    return (
      <div className="space-y-5">
        <SellerPageHeader title="Booster ma visibilité" description="Les demandes de mise en avant sont réservées aux collaborateurs autorisés à communiquer avec le support." />
        <SellerCard><p role="alert" className="py-10 text-center text-sm text-gray-500">Votre rôle ne permet pas d’envoyer une demande de mise en avant.</p></SellerCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SellerPageHeader
        title="Booster ma visibilité"
        description="Propulsez vos articles en tête des résultats de recherche et bénéficiez des encarts recommandés sur MandeMarket."
      />

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setBoostType('product')}
          className={`text-left p-5 rounded-xl border transition ${
            boostType === 'product' ? 'border-brand-orange bg-orange-50/40 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className="font-bold text-brand-navy">Booster un article spécifique</p>
          <p className="text-xs text-gray-500 mt-1">
            Mise en tête de catégorie, badge "Sponsorisé", section "Bons Plans" et résultats prioritaires.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setBoostType('store')}
          className={`text-left p-5 rounded-xl border transition ${
            boostType === 'store' ? 'border-brand-orange bg-orange-50/40 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className="font-bold text-brand-navy">Booster ma boutique</p>
          <p className="text-xs text-gray-500 mt-1">
            Encart "Boutiques recommandées" sur la page d'accueil et bannières thématiques saisonnières.
          </p>
        </button>
      </div>

      <SellerCard title="Formulaire de mise en avant">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (
          <form onSubmit={handleRequestBoost} className="space-y-4 max-w-2xl">
            {boostType === 'product' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sélectionner l'article à mettre en avant
                </label>
                {products.length === 0 ? (
                  <p className="text-xs text-gray-500">Aucun produit actif dans votre catalogue.</p>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {Math.round((p.price || 0) / 100).toLocaleString('fr-FR')} FCFA (Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Durée souhaitée</label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
                >
                  <option value="3">3 jours (Campagne Flash)</option>
                  <option value="7">7 jours (Recommandé)</option>
                  <option value="14">14 jours (2 semaines)</option>
                  <option value="30">30 jours (1 mois complet)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Budget alloué (FCFA)</label>
                <input
                  type="number"
                  min="5000"
                  step="1000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Instructions ou préférences de ciblage (facultatif)
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: Cibler en priorité les recherches 'Chaussures homme' à Bamako..."
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
              />
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Informations sur la campagne</p>
              <p>
                La validation technique et la facturation du boost sont assurées directement par l'équipe administrative de MandeMarket après examen de la conformité de vos visuels et de la disponibilité du stock.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || (boostType === 'product' && products.length === 0)}
                className="px-6 py-2.5 text-xs font-bold rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm disabled:opacity-50 transition"
              >
                {submitting ? 'Transmission...' : '🚀 Soumettre ma demande de mise en avant'}
              </button>
            </div>
          </form>
        )}
      </SellerCard>
    </div>
  );
}
