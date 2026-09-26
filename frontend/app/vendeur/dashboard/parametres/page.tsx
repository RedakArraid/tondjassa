'use client';

import React, { useEffect, useState } from 'react';
import { SellerService } from '../../../config/api';
import { Spinner } from '../_components/sections';
import { SellerPageHeader, SellerCard } from '../_components/ui';
import { useSellerAccess } from '../_components/access';

export default function ComptePage() {
  const { can } = useSellerAccess();
  const canWrite = can('settings.write');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    SellerService.getMySettings()
      .then((data) => {
        if (data) {
          setStoreName(data.storeName || '');
          setSlug(data.slug || '');
          setDescription(data.description || '');
          setPhone(data.paymentInfo?.phone || '');
        }
      })
      .catch((err) => {
        console.error('Erreur chargement paramètres:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await SellerService.updateMySettings({
        storeName: storeName.trim(),
        description: description.trim(),
        paymentInfo: { phone: phone.trim() },
      });
      setFeedback({ type: 'success', message: 'Vos informations ont été mises à jour avec succès.' });
    } catch (err: any) {
      console.error('Erreur sauvegarde paramètres:', err);
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
        title="Paramètres de la boutique"
        description="Gérez les coordonnées publiques et les informations générales de votre compte vendeur."
      />

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      <SellerCard title="Informations de la boutique">
        <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
          <fieldset disabled={!canWrite} className="space-y-4 disabled:opacity-75">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nom de la boutique</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Identifiant public (slug)</label>
              <input
                type="text"
                readOnly
                value={slug}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Téléphone de contact vendeur</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+223 70 00 00 00"
              className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Présentation</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Présentez votre atelier, vos spécialités et vos engagements qualité..."
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
            />
          </div>

          {canWrite && <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm disabled:opacity-50 transition"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>}
          </fieldset>
        </form>
        {!canWrite && <p className="mt-4 text-xs text-gray-500">Consultation uniquement : votre rôle ne permet pas de modifier la boutique.</p>}
      </SellerCard>
    </div>
  );
}
