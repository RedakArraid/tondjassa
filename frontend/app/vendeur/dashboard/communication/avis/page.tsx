'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard, SellerEmptyState, FilterChips } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

const FILTERS = ['Tous', '5 étoiles', '4 étoiles', '3 étoiles et moins', 'Sans réponse'];

export default function AvisPage() {
  const { can } = useSellerAccess();
  const canWrite = can('orders.write');
  const [filter, setFilter] = useState('Tous');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyModalReview, setReplyModalReview] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const data = await SellerService.getMyReviews();
      setReviews(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erreur chargement avis:', err);
      setFeedback({ type: 'error', message: 'Impossible de charger les avis clients.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const filtered = reviews.filter((r) => {
    const hasReply = Boolean(r.sellerReply);
    if (filter === '5 étoiles') return r.rating === 5;
    if (filter === '4 étoiles') return r.rating === 4;
    if (filter === '3 étoiles et moins') return r.rating <= 3;
    if (filter === 'Sans réponse') return !hasReply;
    return true;
  });

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyModalReview || !replyText.trim()) return;

    try {
      setSubmitting(true);
      await SellerService.replyToReview(replyModalReview.id, replyText.trim());
      setFeedback({ type: 'success', message: 'Votre réponse a été publiée avec succès.' });
      setReplyModalReview(null);
      setReplyText('');
      await loadReviews();
    } catch (err: any) {
      console.error('Erreur envoi réponse:', err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la publication de votre réponse.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SellerPageHeader
        title="Avis clients"
        description="Consultez les retours d'expérience sur vos articles et interagissez avec vos acheteurs."
      />

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SellerCard>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <SellerEmptyState
            title="Aucun avis trouvé"
            description="Aucun avis ne correspond au filtre sélectionné pour le moment."
          />
        ) : (
          <div className="space-y-4 divide-y divide-gray-100">
            {filtered.map((rev) => {
              const hasReply = Boolean(rev.sellerReply);
              return (
                <div key={rev.id} className="pt-4 first:pt-0 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold text-lg">
                        {'★'.repeat(Math.max(1, Math.min(5, rev.rating)))}
                        {'☆'.repeat(Math.max(0, 5 - rev.rating))}
                      </span>
                      <span className="text-sm font-semibold text-brand-navy">
                        {rev.customer?.firstName ? `${rev.customer.firstName} ${rev.customer.lastName || ''}` : 'Acheteur vérifié'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(rev.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {rev.product && (
                      <Link
                        href={`/vendeur/dashboard/produits/ajouter?id=${rev.product.id}`}
                        className="text-xs text-brand-orange hover:underline flex items-center gap-1"
                      >
                        📦 {rev.product.name}
                      </Link>
                    )}
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 whitespace-pre-line border border-gray-100">
                    {rev.comment || 'Note attribuée sans commentaire écrit.'}
                  </div>

                  {rev.sellerReply && (
                    <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 text-sm text-gray-700 whitespace-pre-line">
                      <span className="font-semibold text-orange-700">Votre réponse :</span> {rev.sellerReply}
                    </div>
                  )}

                  {canWrite && <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyModalReview(rev);
                        setReplyText(rev.sellerReply || '');
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-navy text-white hover:bg-brand-navy/90 transition shadow-sm"
                    >
                      {hasReply ? 'Modifier ma réponse' : '💬 Répondre publiquement'}
                    </button>
                  </div>}
                </div>
              );
            })}
          </div>
        )}
      </SellerCard>

      {/* Modal de réponse */}
      {canWrite && replyModalReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-brand-navy">
                Répondre à l'avis client
              </h3>
              <button
                type="button"
                onClick={() => setReplyModalReview(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
              <p className="font-semibold text-gray-800">
                Avis sur : {replyModalReview.product?.name || 'Produit'}
              </p>
              <p className="mt-1 italic line-clamp-3">"{replyModalReview.comment}"</p>
            </div>

            <form onSubmit={handleSendReply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Votre réponse officielle (visible publiquement)
                </label>
                <textarea
                  required
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Merci pour votre commande ! Nous sommes ravis que le produit vous plaise..."
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReplyModalReview(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !replyText.trim()}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Publication...' : 'Publier la réponse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
