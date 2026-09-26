'use client';

import { useCallback, useEffect, useState } from 'react';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerActionButton, SellerCard } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

const PREFERENCE_LABELS = {
  newOrder: 'Nouvelle commande',
  newMessage: 'Nouveau message',
  newReview: 'Nouvel avis',
  newFollower: 'Nouvel abonné',
  lowStock: 'Stock faible',
  payments: 'Paiements',
  marketing: 'Marketing',
  platformMessages: 'Messages MandeMarket',
} as const;

type PreferenceKey = keyof typeof PREFERENCE_LABELS;
type NotificationPreferences = Record<PreferenceKey, boolean>;

const PREFERENCE_KEYS = Object.keys(PREFERENCE_LABELS) as PreferenceKey[];

function parsePreferences(payload: unknown): NotificationPreferences {
  if (!payload || typeof payload !== 'object') throw new Error('Réponse de préférences invalide.');
  const wrapped = payload as { preferences?: unknown };
  const candidate = wrapped.preferences ?? payload;
  if (!candidate || typeof candidate !== 'object') throw new Error('Réponse de préférences invalide.');

  const values = candidate as Record<string, unknown>;
  if (!PREFERENCE_KEYS.every(key => typeof values[key] === 'boolean')) {
    throw new Error('Les préférences reçues sont incomplètes.');
  }

  return Object.fromEntries(PREFERENCE_KEYS.map(key => [key, values[key]])) as NotificationPreferences;
}

export default function NotificationsPage() {
  const { can } = useSellerAccess();
  const canWrite = can('settings.write');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await SellerService.getMyNotificationPreferences();
      setPreferences(parsePreferences(data));
    } catch (loadError) {
      setPreferences(null);
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les préférences.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    SellerService.getMyNotificationPreferences()
      .then(data => {
        if (active) setPreferences(parsePreferences(data));
      })
      .catch(loadError => {
        if (!active) return;
        setPreferences(null);
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les préférences.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const toggle = (key: PreferenceKey) => {
    setSuccess(null);
    setPreferences(current => current ? { ...current, [key]: !current[key] } : current);
  };

  const save = async () => {
    if (!preferences) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await SellerService.updateMyNotificationPreferences(preferences);
      setPreferences(parsePreferences(data));
      setSuccess('Vos préférences de notification ont été enregistrées.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer les préférences.');
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <SellerActionButton variant="primary" onClick={() => void save()} disabled={!preferences || loading || saving}>
      {saving ? 'Enregistrement…' : 'Enregistrer'}
    </SellerActionButton>
  );

  return (
    <div className="space-y-4">
      <SellerPageHeader
        title="Notifications"
        description="Choisissez les alertes à recevoir."
        action={canWrite ? saveButton : undefined}
      />

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          {!preferences && (
            <button type="button" onClick={() => void loadPreferences()} className="font-semibold underline">
              Réessayer
            </button>
          )}
        </div>
      )}
      {success && <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{success}</div>}

      <SellerCard>
        {loading ? (
          <div role="status" aria-label="Chargement des préférences" className="flex justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : preferences ? (
          <div className="space-y-3">
            {PREFERENCE_KEYS.map(key => (
              <div key={key} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <span id={`notification-${key}`} className="text-sm font-medium text-brand-navy">{PREFERENCE_LABELS[key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-label={`${PREFERENCE_LABELS[key]} : ${preferences[key] ? 'activé' : 'désactivé'}`}
                  aria-checked={preferences[key]}
                  onClick={() => toggle(key)}
                  disabled={!canWrite}
                  className={`w-11 h-6 rounded-full transition ${preferences[key] ? 'bg-brand-orange' : 'bg-gray-300'}`}
                >
                  <span aria-hidden="true" className={`block w-5 h-5 bg-white rounded-full transition translate-y-0.5 ${preferences[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">Les préférences ne peuvent pas être affichées.</p>
        )}
        {canWrite ? <div className="mt-4">{saveButton}</div> : <p className="mt-4 text-xs text-gray-500">Consultation uniquement : votre rôle ne permet pas de modifier ces préférences.</p>}
      </SellerCard>
    </div>
  );
}
