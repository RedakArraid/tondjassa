'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard, SellerStatGrid } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

export default function StatistiquesMarketingPage() {
  const { can } = useSellerAccess();
  const [loading, setLoading] = useState(true);
  const [promos, setPromos] = useState<any[]>([]);

  useEffect(() => {
    SellerService.getMyPromotions()
      .then((data) => setPromos(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const activeCount = promos.filter((p) => p.isActive).length;
  const totalUses = promos.reduce((sum, p) => sum + (p.usedCount || 0), 0);
  const promotionTypes = promos.reduce<Record<string, number>>((counts, promotion) => {
    const type = String(promotion.type || 'NON_RENSEIGNE');
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
  const dominantType = Object.entries(promotionTypes).sort((a, b) => b[1] - a[1])[0]?.[0];
  const typeLabels: Record<string, string> = { PERCENTAGE: 'Pourcentage', FIXED_AMOUNT: 'Montant fixe', FREE_SHIPPING: 'Livraison gratuite' };

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Performance Marketing"
        description="Mesurez l'efficacité de vos codes promotionnels et opérations spéciales."
        action={can('catalog.write') ? (
          <div className="flex items-center gap-2">
            <Link
              href="/vendeur/dashboard/marketing/coupons"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm transition"
            >
              + Nouveau code promo
            </Link>
          </div>
        ) : undefined}
      />

      <SellerStatGrid
        items={[
          { label: 'Codes promo actifs', value: String(activeCount), hint: 'En circulation' },
          { label: 'Utilisations totales', value: String(totalUses), hint: 'Rédemptions en caisse' },
          { label: 'Campagnes créées', value: String(promos.length), hint: 'Historique boutique' },
          { label: 'Type dominant', value: dominantType ? (typeLabels[dominantType] || dominantType) : '—', hint: promos.length ? 'Mécanisme le plus créé' : 'Aucune donnée' },
        ]}
      />

      <SellerCard title="Codes promotionnels actifs">
        {promos.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">Aucune promotion active pour le moment.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {promos.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-brand-navy bg-orange-50 px-2 py-0.5 rounded border border-orange-100 text-xs">
                    {p.code}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{p.name} · Valeur : {p.value} {p.type === 'FIXED_AMOUNT' ? 'FCFA' : '%'}</p>
                </div>
                <div className="text-right text-xs">
                  <span className="font-semibold text-gray-800">{p.usedCount || 0} utilisation(s)</span>
                  <p className="text-gray-400">Max : {p.maxUses || 'Illimité'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SellerCard>
    </div>
  );
}
