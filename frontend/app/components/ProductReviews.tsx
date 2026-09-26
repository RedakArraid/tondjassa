'use client';

import { useState, useEffect } from 'react';
import { ReviewService } from '../config/api';
import { Review, ReviewStats } from '../../types';
import {
  StarIcon,
  CheckBadgeIcon,
  HandThumbUpIcon,
} from '@heroicons/react/24/solid';
import {
  StarIcon as StarIconOutline,
  HandThumbUpIcon as HandThumbUpIconOutline,
} from '@heroicons/react/24/outline';

interface ProductReviewsProps {
  productId: number;
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    rating: 5,
    title: '',
    comment: '',
  });

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const [reviewsData, statsData] = await Promise.all([
        ReviewService.getByProductId(productId),
        ReviewService.getStats(productId),
      ]);
      setReviews(reviewsData);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur lors du chargement des avis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await ReviewService.create({
        productId,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail || undefined,
        rating: formData.rating,
        title: formData.title || undefined,
        comment: formData.comment,
      });

      // Réinitialiser le formulaire
      setFormData({
        customerName: '',
        customerEmail: '',
        rating: 5,
        title: '',
        comment: '',
      });
      setShowForm(false);
      
      // Recharger les avis
      await loadReviews();
      
      alert('Votre avis a été soumis avec succès !');
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert('Erreur lors de la soumission de l\'avis. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    try {
      await ReviewService.markHelpful(reviewId);
      await loadReviews();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    };

    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            className={`${sizeClasses[size]} ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement des avis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Statistiques des avis */}
      {stats && stats.total > 0 && (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl font-bold text-gray-900">
                  {stats.averageRating.toFixed(1)}
                </div>
                <div>
                  {renderStars(Math.round(stats.averageRating), 'lg')}
                  <p className="text-sm text-gray-600 mt-1">
                    {stats.total} {stats.total === 1 ? 'avis' : 'avis'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution];
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 w-12">
                      {rating} ⭐
                    </span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Formulaire d'ajout d'avis */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 px-4 border-2 border-orange-500 text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-colors"
          >
            Rédiger un avis
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Rédiger un avis</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (optionnel)
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Si vous êtes connecté, l’identité de votre compte est utilisée côté serveur.
              Le badge « Achat vérifié » exige une commande expédiée ou livrée appartenant à ce compte.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note *
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating })}
                    className="focus:outline-none"
                  >
                    {rating <= formData.rating ? (
                      <StarIcon className="w-8 h-8 text-yellow-400" />
                    ) : (
                      <StarIconOutline className="w-8 h-8 text-gray-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titre (optionnel)
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commentaire *
              </label>
              <textarea
                required
                rows={4}
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Partagez votre expérience avec ce produit..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 px-4 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Publier l\'avis'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    customerName: '',
                    customerEmail: '',
                    rating: 5,
                    title: '',
                    comment: '',
                  });
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Liste des avis */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-gray-900">
          Avis clients ({reviews.length})
        </h3>

        {reviews.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
            <p className="text-gray-600 mb-4">Aucun avis pour ce produit.</p>
            <p className="text-sm text-gray-500">Soyez le premier à donner votre avis !</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-xl p-6 border border-gray-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-bold text-gray-900">{review.customerName}</h4>
                    {review.isVerified && (
                      <CheckBadgeIcon className="w-5 h-5 text-blue-500" title="Achat vérifié" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {renderStars(review.rating, 'sm')}
                    {review.title && (
                      <span className="text-sm font-medium text-gray-900">{review.title}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <p className="text-gray-700 mb-4 leading-relaxed">{review.comment}</p>

              {review.sellerReply && (
                <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Réponse de la boutique</p>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-line">{review.sellerReply}</p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleHelpful(review.id)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600 transition-colors"
                >
                  {review.helpful > 0 ? (
                    <HandThumbUpIcon className="w-5 h-5" />
                  ) : (
                    <HandThumbUpIconOutline className="w-5 h-5" />
                  )}
                  <span>Utile ({review.helpful})</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

