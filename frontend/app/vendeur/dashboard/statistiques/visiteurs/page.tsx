'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard, SellerStatGrid } from '../../_components/ui';

export default function StatistiquesVisiteursPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    Promise.allSettled([
      SellerService.getMyCustomers(),
      SellerService.getMyReviews(),
    ]).then((results) => {
      if (results[0].status === 'fulfilled') setCustomers(Array.isArray(results[0].value) ? results[0].value : []);
      if (results[1].status === 'fulfilled') setReviews(Array.isArray(results[1].value) ? results[1].value : []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Audience acheteurs"
        description="Indicateurs calculés uniquement à partir des clients et avis réellement enregistrés. Les visites anonymes ne sont pas mesurées."
      />

      <SellerStatGrid
        items={[
          { label: 'Clients acheteurs', value: String(customers.length), hint: 'Clients ayant commandé' },
          { label: 'Avis reçus', value: String(reviews.length), hint: 'Retours d’expérience vérifiés' },
          { label: 'Note moyenne', value: avgRating ? `${avgRating} / 5` : '—', hint: reviews.length ? 'Évaluation globale boutique' : 'Aucun avis reçu' },
          { label: 'Taux d’engagement', value: reviews.length > 0 ? `${Math.round((reviews.length / Math.max(1, customers.length)) * 100)} %` : '—', hint: 'Ratio avis / acheteurs' },
        ]}
      />

      <SellerCard title="Actions d'engagement recommandées">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-brand-navy">Interagir avec vos avis clients</p>
              <p className="text-xs text-gray-500">Répondez publiquement pour valoriser votre service après-vente.</p>
            </div>
            <Link
              href="/vendeur/dashboard/communication/avis"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-navy text-white hover:bg-brand-navy/90 transition text-center"
            >
              Consulter les avis ({reviews.length})
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-brand-navy">Envoyer un message à vos acheteurs</p>
              <p className="text-xs text-gray-500">Communiquez sur les nouveautés et offres spéciales.</p>
            </div>
            <Link
              href="/vendeur/dashboard/communication/messages"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90 transition text-center"
            >
              Messagerie clients ({customers.length})
            </Link>
          </div>
        </div>
      </SellerCard>
    </div>
  );
}
