'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  Bars3BottomLeftIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiFetch, logoutSession } from '../../lib/api-fetch';
import {
  SupportService,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../../config/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

type StaffUser = { id: string; email: string; name?: string | null; role: string };
type Person = { id?: string; name?: string | null; email?: string | null };

type TicketMessage = {
  id: string;
  message?: string;
  content?: string;
  body?: string;
  internal?: boolean;
  createdAt: string;
  authorName?: string;
  authorEmail?: string;
  author?: Person | null;
  sender?: Person | null;
};

type SupportTicket = {
  id: string;
  reference?: string;
  source?: string;
  category?: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  seller?: { id: string; storeName: string; slug?: string } | null;
  assignedTo?: Person | null;
  assignedToId?: string | null;
  messages?: TicketMessage[];
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  total: number;
  open: number;
  inProgress: number;
  waitingCustomer: number;
  resolved: number;
  urgent: number;
  unassigned: number;
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  WAITING_CUSTOMER: 'En attente client',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé',
};

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: 'Basse', NORMAL: 'Normale', HIGH: 'Haute', URGENT: 'Urgente',
};

const STATUS_STYLES: Record<SupportTicketStatus, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-violet-50 text-violet-700 border-violet-200',
  WAITING_CUSTOMER: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PRIORITY_STYLES: Record<SupportTicketPriority, string> = {
  LOW: 'text-slate-500', NORMAL: 'text-blue-600', HIGH: 'text-orange-600', URGENT: 'text-red-600',
};

const EMPTY_STATS: Stats = { total: 0, open: 0, inProgress: 0, waitingCustomer: 0, resolved: 0, urgent: 0, unassigned: 0 };

function formatDate(value?: string) {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function messageText(message: TicketMessage) {
  return message.message || message.content || message.body || '';
}

function messageAuthor(message: TicketMessage) {
  return message.author?.name || message.sender?.name || message.authorName || message.author?.email || message.sender?.email || message.authorEmail || 'Demandeur';
}

export default function SupportDashboardPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SupportTicketStatus | ''>('');
  const [priority, setPriority] = useState<SupportTicketPriority | ''>('');
  const [assignedTo, setAssignedTo] = useState<'' | 'me' | 'unassigned'>('');
  const [page, setPage] = useState(1);
  const [reply, setReply] = useState('');
  const [internalReply, setInternalReply] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const token = sessionStorage.getItem('admin_token');
      if (!token) {
        router.replace('/support/login?error=expired');
        return;
      }
      try {
        const response = await apiFetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !['support', 'admin'].includes(data.user?.role)) {
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin_user');
          router.replace('/support/login?error=unauthorized');
          return;
        }
        sessionStorage.setItem('admin_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      } catch {
        setError("Impossible de vérifier la session. Vérifiez votre connexion puis réessayez.");
      } finally {
        setAuthLoading(false);
      }
    };
    verify();
  }, [router]);

  const loadTickets = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const [statsResult, ticketsResult] = await Promise.allSettled([
        SupportService.getStats(),
        SupportService.getTickets({ page, limit: 20, status, priority, search, assignedTo }),
      ]);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value?.stats || EMPTY_STATS);
      else setStats(null);
      if (ticketsResult.status === 'rejected') throw ticketsResult.reason;
      const payload = ticketsResult.value;
      const nextTickets = Array.isArray(payload) ? payload : payload?.tickets || [];
      setTickets(nextTickets);
      setPagination(payload?.pagination || { page, limit: 20, total: nextTickets.length, pages: 1 });
    } catch (caught) {
      setTickets([]);
      setError(caught instanceof Error ? caught.message : 'Chargement des tickets impossible');
    } finally {
      setLoading(false);
    }
  }, [assignedTo, currentUser, page, priority, search, status]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setMobileListOpen(false);
    setDetailLoading(true);
    setDetailError('');
    try {
      const payload = await SupportService.getTicket(ticket.id);
      setSelectedTicket(payload?.ticket || payload);
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : 'Détail du ticket indisponible');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateTicket = async (data: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    assignedToId?: string | null;
  }) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    setDetailError('');
    try {
      const payload = await SupportService.updateTicket(selectedTicket.id, data);
      const updated = payload?.ticket || payload;
      setSelectedTicket((ticket) => ticket ? { ...ticket, ...updated } : updated);
      setTickets((items) => items.map((ticket) => ticket.id === updated.id ? { ...ticket, ...updated } : ticket));
      const statsPayload = await SupportService.getStats().catch(() => null);
      if (statsPayload?.stats) setStats(statsPayload.stats);
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : 'Mise à jour impossible');
    } finally {
      setActionLoading(false);
    }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTicket || !reply.trim()) return;
    setActionLoading(true);
    setDetailError('');
    try {
      const payload = await SupportService.addMessage(selectedTicket.id, reply.trim(), internalReply);
      if (payload?.ticket) {
        setSelectedTicket(payload.ticket);
      } else if (payload?.message) {
        setSelectedTicket((ticket) => ticket ? { ...ticket, messages: [...(ticket.messages || []), payload.message] } : ticket);
      } else {
        await openTicket(selectedTicket);
      }
      setReply('');
      setInternalReply(false);
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : "Envoi de la réponse impossible");
    } finally {
      setActionLoading(false);
    }
  };

  const logout = async () => {
    try {
      await logoutSession('staff');
      router.push('/support/login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Déconnexion impossible');
    }
  };

  const orderedMessages = useMemo(
    () => [...(selectedTicket?.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [selectedTicket?.messages]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div role="status" className="text-center">
          <ArrowPathIcon className="mx-auto h-9 w-9 animate-spin text-emerald-400" />
          <p className="mt-3 text-sm text-slate-300">Vérification des accès support…</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return error ? (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <ExclamationTriangleIcon className="mx-auto h-10 w-10 text-red-500" />
          <p role="alert" className="mt-3 text-slate-700">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-white">Réessayer</button>
        </div>
      </main>
    ) : null;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-emerald-500 p-2"><ChatBubbleLeftRightIcon className="h-6 w-6" /></div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold">Support MandeMarket</h1>
              <p className="truncate text-xs text-slate-400">{currentUser.name || currentUser.email} · {currentUser.role === 'admin' ? 'Administrateur' : 'Agent support'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMobileListOpen((value) => !value)} className="rounded-lg p-2 hover:bg-white/10 lg:hidden" aria-label="Afficher ou masquer la liste des tickets" aria-expanded={mobileListOpen}>
              {mobileListOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3BottomLeftIcon className="h-5 w-5" />}
            </button>
            <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">
              <ArrowRightOnRectangleIcon className="h-5 w-5" /><span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] p-4 sm:p-6">
        {stats ? (
          <section aria-label="Indicateurs support" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {[
              { label: 'Total', value: stats.total, Icon: ChatBubbleLeftRightIcon, style: 'text-slate-700 bg-white' },
              { label: 'Ouverts', value: stats.open, Icon: EnvelopeIcon, style: 'text-blue-700 bg-blue-50' },
              { label: 'En cours', value: stats.inProgress, Icon: ClockIcon, style: 'text-violet-700 bg-violet-50' },
              { label: 'Attente client', value: stats.waitingCustomer, Icon: UserIcon, style: 'text-amber-700 bg-amber-50' },
              { label: 'Résolus', value: stats.resolved, Icon: CheckCircleIcon, style: 'text-emerald-700 bg-emerald-50' },
              { label: 'Urgents', value: stats.urgent, Icon: ExclamationTriangleIcon, style: 'text-red-700 bg-red-50' },
              { label: 'Non assignés', value: stats.unassigned, Icon: UsersIcon, style: 'text-orange-700 bg-orange-50' },
            ].map(({ label, value, Icon, style }) => (
              <div key={label} className={`rounded-xl border border-slate-200 p-3 shadow-sm ${style}`}>
                <Icon className="h-5 w-5" />
                <p className="mt-2 text-2xl font-extrabold">{value}</p>
                <p className="text-xs font-semibold">{label}</p>
              </div>
            ))}
          </section>
        ) : !loading && (
          <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Les indicateurs sont temporairement indisponibles. La liste reste utilisable.</p>
        )}

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid min-h-[680px] gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
          <section className={`${mobileListOpen ? 'block' : 'hidden'} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block`} aria-label="Liste des tickets">
            <div className="border-b border-slate-200 p-4">
              <form
                onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}
                className="flex gap-2"
                role="search"
              >
                <label htmlFor="ticket-search" className="sr-only">Rechercher un ticket</label>
                <div className="relative min-w-0 flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input id="ticket-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Référence, nom, email…" />
                </div>
                <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">OK</button>
              </form>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-600">Statut
                  <select value={status} onChange={(event) => { setStatus(event.target.value as SupportTicketStatus | ''); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal">
                    <option value="">Tous</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">Priorité
                  <select value={priority} onChange={(event) => { setPriority(event.target.value as SupportTicketPriority | ''); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal">
                    <option value="">Toutes</option>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-xs font-semibold text-slate-600">Assignation
                <select value={assignedTo} onChange={(event) => { setAssignedTo(event.target.value as typeof assignedTo); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal">
                  <option value="">Tous les tickets</option><option value="me">Mes tickets</option><option value="unassigned">Non assignés</option>
                </select>
              </label>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {loading ? (
                <div role="status" className="flex justify-center py-16"><ArrowPathIcon className="h-7 w-7 animate-spin text-emerald-600" /></div>
              ) : tickets.length === 0 ? (
                <div className="px-6 py-16 text-center"><CheckCircleIcon className="mx-auto h-10 w-10 text-emerald-500" /><p className="mt-3 font-semibold">Aucun ticket trouvé</p><p className="mt-1 text-sm text-slate-500">Modifiez les filtres ou la recherche.</p></div>
              ) : tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => openTicket(ticket)}
                  aria-pressed={selectedTicket?.id === ticket.id}
                  className={`w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${selectedTicket?.id === ticket.id ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-slate-500">{ticket.reference || `#${ticket.id.slice(0, 8)}`}</span>
                    <span className={`text-xs font-bold ${PRIORITY_STYLES[ticket.priority]}`}>{PRIORITY_LABELS[ticket.priority]}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-900">{ticket.subject}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{ticket.requesterName || ticket.requesterEmail || ticket.seller?.storeName || 'Demandeur inconnu'}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span>
                    <time className="text-[11px] text-slate-400">{formatDate(ticket.lastMessageAt || ticket.updatedAt)}</time>
                  </div>
                </button>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Précédent</button>
                <span>Page {pagination.page} / {pagination.pages}</span>
                <button type="button" onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))} disabled={page >= pagination.pages} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Suivant</button>
              </div>
            )}
          </section>

          <section className={`${mobileListOpen ? 'hidden' : 'block'} min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block`} aria-label="Détail du ticket">
            {!selectedTicket ? (
              <div className="flex min-h-[600px] items-center justify-center p-8 text-center">
                <div><ChatBubbleLeftRightIcon className="mx-auto h-14 w-14 text-slate-300" /><h2 className="mt-4 text-xl font-bold">Sélectionnez un ticket</h2><p className="mt-2 text-sm text-slate-500">Le détail, l’historique et les actions apparaîtront ici.</p></div>
              </div>
            ) : detailLoading ? (
              <div role="status" className="flex min-h-[600px] items-center justify-center"><ArrowPathIcon className="h-8 w-8 animate-spin text-emerald-600" /></div>
            ) : (
              <div className="flex min-h-[680px] flex-col">
                <div className="border-b border-slate-200 p-4 sm:p-6">
                  <button type="button" onClick={() => setMobileListOpen(true)} className="mb-3 text-sm font-semibold text-emerald-700 lg:hidden">← Retour aux tickets</button>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{selectedTicket.reference || `#${selectedTicket.id.slice(0, 8)}`}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[selectedTicket.status]}`}>{STATUS_LABELS[selectedTicket.status]}</span>
                      </div>
                      <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">{selectedTicket.subject}</h2>
                      <p className="mt-1 text-xs text-slate-500">Créé le {formatDate(selectedTicket.createdAt)} · {selectedTicket.category || 'Catégorie non renseignée'} · {selectedTicket.source || 'Source non renseignée'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <label className="text-xs font-semibold text-slate-600">Statut
                        <select value={selectedTicket.status} onChange={(event) => updateTicket({ status: event.target.value as SupportTicketStatus })} disabled={actionLoading} className="mt-1 block rounded-lg border border-slate-300 p-2 text-sm font-normal">
                          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Priorité
                        <select value={selectedTicket.priority} onChange={(event) => updateTicket({ priority: event.target.value as SupportTicketPriority })} disabled={actionLoading} className="mt-1 block rounded-lg border border-slate-300 p-2 text-sm font-normal">
                          {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Demandeur</p>
                      <p className="mt-2 font-semibold">{selectedTicket.requesterName || selectedTicket.seller?.storeName || 'Nom non renseigné'}</p>
                      {selectedTicket.requesterEmail && <a href={`mailto:${selectedTicket.requesterEmail}`} className="mt-1 flex items-center gap-2 text-emerald-700 hover:underline"><EnvelopeIcon className="h-4 w-4" />{selectedTicket.requesterEmail}</a>}
                      {selectedTicket.requesterPhone && <a href={`tel:${selectedTicket.requesterPhone}`} className="mt-1 flex items-center gap-2 text-slate-600 hover:underline"><PhoneIcon className="h-4 w-4" />{selectedTicket.requesterPhone}</a>}
                      {selectedTicket.seller && <p className="mt-2 text-xs text-slate-500">Boutique : {selectedTicket.seller.storeName}</p>}
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Assignation</p>
                      <p className="mt-2 font-semibold">{selectedTicket.assignedTo?.name || selectedTicket.assignedTo?.email || 'Non assigné'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => updateTicket({ assignedToId: currentUser.id })} disabled={actionLoading || selectedTicket.assignedTo?.id === currentUser.id || selectedTicket.assignedToId === currentUser.id} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">M’assigner</button>
                        {(selectedTicket.assignedTo || selectedTicket.assignedToId) && <button type="button" onClick={() => updateTicket({ assignedToId: null })} disabled={actionLoading} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">Désassigner</button>}
                      </div>
                    </div>
                  </div>
                </div>

                {detailError && <p role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{detailError}</p>}

                <div className="flex-1 bg-slate-50 p-4 sm:p-6">
                  <h3 className="mb-4 font-bold">Historique ({orderedMessages.length})</h3>
                  {orderedMessages.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Aucun message n’a encore été enregistré pour ce ticket.</p>
                  ) : (
                    <ol className="space-y-4">
                      {orderedMessages.map((message) => (
                        <li key={message.id} className={`rounded-xl border p-4 shadow-sm ${message.internal ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-700">{messageAuthor(message)} {message.internal && <span className="ml-1 rounded bg-amber-200 px-1.5 py-0.5 text-amber-900">Note interne</span>}</span>
                            <time className="text-slate-400">{formatDate(message.createdAt)}</time>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{messageText(message) || 'Message sans contenu textuel'}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <form onSubmit={sendReply} className="border-t border-slate-200 bg-white p-4 sm:p-6">
                  <label htmlFor="support-reply" className="text-sm font-bold">Réponse</label>
                  <textarea id="support-reply" value={reply} onChange={(event) => setReply(event.target.value)} rows={4} maxLength={5000} required className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder={internalReply ? "Écrire une note visible uniquement par l'équipe…" : 'Répondre au demandeur…'} />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={internalReply} onChange={(event) => setInternalReply(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-600" />Note interne</label>
                    <button type="submit" disabled={actionLoading || !reply.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><PaperAirplaneIcon className="h-4 w-4" />{actionLoading ? 'Envoi…' : internalReply ? 'Ajouter la note' : 'Envoyer la réponse'}</button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
