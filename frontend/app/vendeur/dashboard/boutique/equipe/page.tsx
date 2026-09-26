'use client';

import React, { useEffect, useState } from 'react';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard } from '../../_components/ui';

export default function EquipePage() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    SellerService.getMyTeam()
      .then((data) => setTeam(Array.isArray(data) ? data : []))
      .catch((err: any) => setError(err.message || 'Impossible de charger les membres.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <SellerPageHeader title="Gestion de l'équipe" description="Consultez les accès actuellement actifs sur votre boutique." />
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
        Les comptes collaborateurs et leurs permissions fines ne sont pas encore activés.
        Aucune invitation n'est simulée ni envoyée tant que ce contrôle d'accès n'est pas disponible.
      </div>
      {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">{error}</div>}
      <SellerCard title="Accès à la boutique">
        {loading ? <div className="flex justify-center py-12"><Spinner size="md" /></div> : (
          <div className="divide-y divide-gray-100">
            {team.map((member) => (
              <div key={member.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-brand-navy">{member.name || member.email}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">{member.role}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{member.email}</p>
                </div>
                <span className="text-xs text-emerald-600 font-semibold">Actif</span>
              </div>
            ))}
          </div>
        )}
      </SellerCard>
    </div>
  );
}
