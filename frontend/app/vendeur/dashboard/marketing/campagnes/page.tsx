'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard, SellerEmptyState } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

export default function CampagnesPage() {
  const { can } = useSellerAccess();
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SellerService.getMyPromotions()
      .then((data) => setPromos(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <SellerPageHeader
        title="Campagnes marketing"
        description="Pilotez la visibilité et l'attractivité de vos offres commerciales sur MandeMarket."
        action={
          <div className="flex items-center gap-2">
            {can('catalog.write') && <Link
              href="/vendeur/dashboard/marketing/coupons"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm transition"
            >
              + Nouveau code promo
            </Link>}
            {can('orders.write') && <Link
              href="/vendeur/dashboard/communication/support"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition"
            >
              Demander une mise en avant
            </Link>}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-2">
          <span className="text-2xl">🎟️</span>
          <h4 className="font-bold text-brand-navy text-sm">Codes promotionnels</h4>
          <p className="text-xs text-gray-500">
            Créez des remises en pourcentage, montants fixes ou livraisons gratuites utilisables lors du checkout.
          </p>
          {can('catalog.write') && <Link
            href="/vendeur/dashboard/marketing/coupons"
            className="inline-block text-xs font-semibold text-brand-orange hover:underline pt-2"
          >
            Gérer mes codes promo →
          </Link>}
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-2">
          <span className="text-2xl">🌟</span>
          <h4 className="font-bold text-brand-navy text-sm">Sélection "Bons Plans"</h4>
          <p className="text-xs text-gray-500">
            Les articles avec au moins 10% de remise et un stock garanti sont éligibles à la section Bons Plans.
          </p>
          <Link
            href="/vendeur/dashboard/produits"
            className="inline-block text-xs font-semibold text-brand-orange hover:underline pt-2"
          >
            Ajuster le prix de mes articles →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-2">
          <span className="text-2xl">📢</span>
          <h4 className="font-bold text-brand-navy text-sm">Mise en avant sponsorisée</h4>
          <p className="text-xs text-gray-500">
            Demandez un encart publicitaire sur la page d'accueil ou en tête de catégorie auprès de l'équipe MandeMarket.
          </p>
          {can('orders.write') && <Link
            href="/vendeur/dashboard/communication/support"
            className="inline-block text-xs font-semibold text-brand-orange hover:underline pt-2"
          >
            Contacter le support →
          </Link>}
        </div>
      </div>

      <SellerCard title="Vos campagnes & promotions actives">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : promos.length === 0 ? (
          <SellerEmptyState
            title="Aucune campagne active"
            description="Créez votre première promotion pour attirer de nouveaux acheteurs sur votre boutique."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {promos.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-brand-navy bg-orange-50 px-2 py-0.5 rounded border border-orange-100 text-xs">
                      {p.code}
                    </span>
                    <span className="text-xs text-emerald-700 font-semibold">Active</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{p.name} · Valeur : {p.value} {p.type === 'FIXED_AMOUNT' ? 'FCFA' : '%'}</p>
                </div>
                {can('catalog.write') && <Link
                  href="/vendeur/dashboard/marketing/coupons"
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Gérer
                </Link>}
              </div>
            ))}
          </div>
        )}
      </SellerCard>
    </div>
  );
}
