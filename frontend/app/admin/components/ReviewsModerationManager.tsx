'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { AdminService } from '../../config/api';

interface Review {
  id: string;
  rating: number;
  title?: string;
  comment: string;
  sellerReply?: string | null;
  sellerReplyAt?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  isVerified: boolean;
  customerName: string;
  customerEmail?: string;
  createdAt: string;
  product?: {
    id: number;
    name: string;
    image?: string;
    seller?: { id: string; storeName: string };
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function ReviewsModerationManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AdminService.getReviews(
        statusFilter === 'all' ? undefined : statusFilter,
        page,
        20
      );
      setReviews(res.reviews || []);
      setPagination(res.pagination || null);
    } catch (err) {
      console.error('Erreur chargement avis:', err);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleModerate = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    try {
      await AdminService.moderateReview(id, status);
      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur modération avis');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête et filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-orange-600" />
            Modération des avis clients
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Vérification de l'authenticité et validation des évaluations produits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
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
                  ? 'À modérer'
                  : s === 'approved'
                  ? 'Approuvés'
                  : 'Rejetés'}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchReviews()}
            disabled={loading}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
            title="Rafraîchir"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Liste des avis */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">Aucun avis à afficher</h3>
          <p className="text-xs text-gray-500 mt-1">
            {statusFilter === 'pending'
              ? 'Tous les avis ont été modérés.'
              : 'Aucun avis ne correspond au filtre sélectionné.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-orange-200 transition-all shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Infos produit & acheteur */}
                <div className="flex items-start gap-4">
                  {review.product?.image ? (
                    <img
                      src={review.product.image}
                      alt={review.product.name}
                      className="w-14 h-14 object-cover rounded-xl border border-gray-100 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 flex-shrink-0">
                      📦
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">
                      {review.product?.name || 'Produit inconnu'}
                    </h4>
                    {review.product?.seller && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Boutique : {review.product.seller.storeName}
                      </p>
                    )}

                    {/* Note en étoiles */}
                    <div className="flex items-center gap-1 mt-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        star <= review.rating ? (
                          <StarIconSolid key={star} className="w-4 h-4 text-amber-400" />
                        ) : (
                          <StarIcon key={star} className="w-4 h-4 text-gray-300" />
                        )
                      ))}
                      <span className="text-xs font-bold text-gray-700 ml-1.5">
                        {review.rating}/5
                      </span>
                      {review.isVerified && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-semibold border border-green-200">
                          <ShieldCheckIcon className="w-3 h-3" />
                          Achat vérifié
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Statut & Actions */}
                <div className="flex items-center gap-2 self-end sm:self-start">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      review.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : review.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {review.status === 'approved'
                      ? 'Approuvé'
                      : review.status === 'rejected'
                      ? 'Rejeté'
                      : 'En attente'}
                  </span>

                  {review.status !== 'approved' && (
                    <button
                      onClick={() => handleModerate(review.id, 'approved')}
                      disabled={actionLoading === review.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Approuver
                    </button>
                  )}

                  {review.status !== 'rejected' && (
                    <button
                      onClick={() => handleModerate(review.id, 'rejected')}
                      disabled={actionLoading === review.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      Rejeter
                    </button>
                  )}
                </div>
              </div>

              {/* Commentaire de l'acheteur */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                {review.title && (
                  <p className="font-semibold text-gray-900 text-sm mb-1">{review.title}</p>
                )}
                <p className="text-xs text-gray-700 leading-relaxed">{review.comment}</p>
                {review.sellerReply && (
                  <div className="mt-2 rounded-lg bg-orange-50 border border-orange-100 p-2 text-xs text-gray-700">
                    <span className="font-semibold text-orange-700">Réponse boutique :</span> {review.sellerReply}
                  </div>
                )}
                <p className="text-[11px] text-gray-400 mt-2">
                  Par <span className="font-medium text-gray-600">{review.customerName}</span>{' '}
                  {review.customerEmail ? `(${review.customerEmail})` : ''} le{' '}
                  {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-gray-500">
                Page {pagination.page} sur {pagination.pages} ({pagination.total} avis au total)
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
    </div>
  );
}
