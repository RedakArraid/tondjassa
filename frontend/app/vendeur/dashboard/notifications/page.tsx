'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { SellerService } from '../../../config/api';
import { SellerPageHeader, SellerCard, FilterChips } from '../_components/ui';

type SellerNotification = {
  id: string;
  type?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: { href?: string; url?: string } | null;
  metadata?: { href?: string; url?: string } | null;
};

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function safeHref(notification: SellerNotification) {
  const candidate = notification.metadata?.href || notification.metadata?.url || notification.data?.href || notification.data?.url;
  return typeof candidate === 'string' && candidate.startsWith('/vendeur/dashboard') ? candidate : null;
}

export default function SellerNotificationsPage() {
  const [notifications, setNotifications] = useState<SellerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('Toutes');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await SellerService.getMyNotifications();
      const items = Array.isArray(payload) ? payload : payload?.notifications || [];
      setNotifications(items);
      setUnreadCount(typeof payload?.unreadCount === 'number' ? payload.unreadCount : items.filter((item: SellerNotification) => !item.isRead).length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement des notifications impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    setUpdating(id);
    setError('');
    try {
      await SellerService.markNotificationRead(id);
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mise à jour impossible');
    } finally {
      setUpdating(null);
    }
  };

  const markAllRead = async () => {
    setUpdating('all');
    setError('');
    try {
      await SellerService.markAllNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mise à jour impossible');
    } finally {
      setUpdating(null);
    }
  };

  const displayed = useMemo(
    () => filter === 'Non lues' ? notifications.filter((item) => !item.isRead) : notifications,
    [filter, notifications]
  );

  return (
    <div className="space-y-5">
      <SellerPageHeader
        title="Centre de notifications"
        description="Commandes, messages, avis et informations importantes de votre boutique."
        action={unreadCount > 0 ? (
          <button type="button" onClick={markAllRead} disabled={updating === 'all'} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50">
            {updating === 'all' ? 'Mise à jour…' : `Tout marquer comme lu (${unreadCount})`}
          </button>
        ) : undefined}
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="flex items-center gap-2"><ExclamationTriangleIcon className="h-5 w-5 shrink-0" />{error}</span>
          <button type="button" onClick={load} className="font-bold underline">Réessayer</button>
        </div>
      )}

      <FilterChips options={['Toutes', 'Non lues']} value={filter} onChange={setFilter} />

      <SellerCard>
        {loading ? (
          <div role="status" className="flex justify-center py-16"><ArrowPathIcon className="h-8 w-8 animate-spin text-brand-orange" /></div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 font-semibold text-brand-navy">{filter === 'Non lues' ? 'Tout est lu' : 'Aucune notification'}</p>
            <p className="mt-1 text-sm text-gray-500">Les nouvelles informations apparaîtront ici automatiquement.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {displayed.map((notification) => {
              const href = safeHref(notification);
              return (
                <li key={notification.id} className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-start ${notification.isRead ? '' : 'bg-orange-50/40 -mx-5 px-5'}`}>
                  <div className={`mt-0.5 rounded-full p-2 ${notification.isRead ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-brand-orange'}`}>
                    <BellIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-brand-navy">{notification.title}</p>
                      {!notification.isRead && <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-bold text-white">Nouvelle</span>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{notification.message}</p>
                    <time className="mt-2 block text-xs text-gray-400">{dateLabel(notification.createdAt)}</time>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {href && <Link href={href} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Ouvrir</Link>}
                    {!notification.isRead && (
                      <button type="button" onClick={() => markRead(notification.id)} disabled={updating === notification.id} className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                        {updating === notification.id ? '…' : 'Marquer comme lue'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SellerCard>
    </div>
  );
}
