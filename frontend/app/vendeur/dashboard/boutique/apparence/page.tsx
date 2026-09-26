'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

export default function ApparencePage() {
  const { can } = useSellerAccess();
  const canWrite = can('settings.write');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [banner, setBanner] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    SellerService.getMySettings()
      .then((data) => {
        if (data) {
          setStoreName(data.storeName || '');
          setSlug(data.slug || '');
          setDescription(data.description || '');
          setLogo(data.logo || '');
          setBanner(data.paymentInfo?.banner || '');
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await SellerService.updateMySettings({
        storeName: storeName.trim(),
        description: description.trim(),
        logo: logo.trim(),
        paymentInfo: { banner: banner.trim() },
      });
      setFeedback({ type: 'success', message: 'L’apparence de votre boutique a été mise à jour.' });
    } catch (err: any) {
      console.error('Erreur sauvegarde apparence:', err);
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
        title="Apparence de la vitrine"
        description="Personnalisez la vitrine de votre boutique vue par les clients sur la marketplace."
        action={
          <div className="flex items-center gap-2">
            <Link
              href={slug ? `/vendeur/${slug}` : '/vendeur'}
              target="_blank"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition"
            >
              👁️ Prévisualiser ma boutique
            </Link>
          </div>
        }
      />

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <fieldset disabled={!canWrite} className="space-y-6 disabled:opacity-75">
        <SellerCard title="Identité visuelle">
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nom affiché</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">URL du Logo</label>
              <input
                type="url"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://images.mandemarket.com/logo.png"
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
              {logo && (
                <div className="mt-2 flex items-center gap-3">
                  <img src={logo} alt="Logo preview" className="w-16 h-16 rounded-full object-cover border" />
                  <span className="text-xs text-gray-400">Aperçu du logo</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">URL de la Bannière / Photo de couverture</label>
              <input
                type="url"
                value={banner}
                onChange={(e) => setBanner(e.target.value)}
                placeholder="https://images.mandemarket.com/banner.jpg"
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
              {banner && (
                <div className="mt-2">
                  <img src={banner} alt="Banner preview" className="w-full h-32 rounded-xl object-cover border" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description publique de la boutique</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Spécialiste de la maroquinerie artisanale et des tissus traditionnels..."
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
              />
            </div>
          </div>
        </SellerCard>

        {canWrite && <div className="flex justify-end">
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
    </div>
  );
}
