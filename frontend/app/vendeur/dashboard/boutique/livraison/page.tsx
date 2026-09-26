'use client';

import React, { useEffect, useState } from 'react';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

interface ShippingZone {
  id: string;
  name: string;
  price: string;
  delay: string;
  freeFrom: string;
}

const DEFAULT_ZONES: ShippingZone[] = [
  { id: '1', name: 'Bamako (Centre & Communes)', price: '1500', delay: '24h', freeFrom: '25000' },
  { id: '2', name: 'Périphérie Bamako', price: '2500', delay: '24-48h', freeFrom: '35000' },
  { id: '3', name: 'Régions & Villes intérieures', price: '4000', delay: '48-72h', freeFrom: '50000' },
];

export default function LivraisonPage() {
  const { can } = useSellerAccess();
  const canWrite = can('settings.write');
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    SellerService.getMySettings()
      .then((data) => {
        const saved = data?.paymentInfo?.shippingZones;
        if (Array.isArray(saved) && saved.length > 0) {
          setZones(saved);
        } else {
          setZones(DEFAULT_ZONES);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleAddZone = () => {
    setZones((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: 'Nouvelle zone',
        price: '2000',
        delay: '24-48h',
        freeFrom: '30000',
      },
    ]);
  };

  const handleUpdateZone = (index: number, field: keyof ShippingZone, value: string) => {
    setZones((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await SellerService.updateMySettings({
        paymentInfo: { shippingZones: zones },
      });
      setFeedback({ type: 'success', message: 'Grille tarifaire de livraison enregistrée avec succès.' });
    } catch (err: any) {
      console.error('Erreur sauvegarde livraison:', err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Zones et tarifs de livraison"
        description="Configurez les frais et délais d'expédition appliqués aux paniers de vos acheteurs."
        action={canWrite ? (
          <button
            type="button"
            onClick={handleAddZone}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition"
          >
            + Ajouter une zone
          </button>
        ) : undefined}
      />

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      <SellerCard title="Grille des zones d'expédition">
        <div className="space-y-4">
          {zones.map((z, idx) => (
            <div key={z.id} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nom de la zone</label>
                  <input
                    type="text"
                    value={z.name}
                    disabled={!canWrite}
                    onChange={(e) => handleUpdateZone(idx, 'name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tarif (FCFA)</label>
                  <input
                    type="number"
                    value={z.price}
                    disabled={!canWrite}
                    onChange={(e) => handleUpdateZone(idx, 'price', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Délai estimé</label>
                  <input
                    type="text"
                    value={z.delay}
                    disabled={!canWrite}
                    onChange={(e) => handleUpdateZone(idx, 'delay', e.target.value)}
                    placeholder="Ex: 24-48h"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Livraison gratuite dès (FCFA)</label>
                  <input
                    type="number"
                    value={z.freeFrom}
                    disabled={!canWrite}
                    onChange={(e) => handleUpdateZone(idx, 'freeFrom', e.target.value)}
                    placeholder="Optionnel"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              {canWrite && <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleRemoveZone(z.id)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Supprimer cette zone
                </button>
              </div>}
            </div>
          ))}

          {canWrite && <div className="flex items-center justify-between pt-4 border-t">
            <button
              type="button"
              onClick={handleAddZone}
              className="text-xs font-bold text-brand-orange hover:underline"
            >
              + Ajouter une zone supplémentaire
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm disabled:opacity-50 transition"
            >
              {saving ? 'Sauvegarde...' : 'Enregistrer la grille'}
            </button>
          </div>}
        </div>
      </SellerCard>
    </div>
  );
}
