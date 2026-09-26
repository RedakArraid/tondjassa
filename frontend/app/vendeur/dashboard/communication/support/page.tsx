'use client';

import React, { useEffect, useState } from 'react';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard, SellerEmptyState } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

const CATEGORIES = [
  'Commande & Expédition',
  'Paiement & Retraits',
  'Catalogue & Produits',
  'Compte & Identifiants',
  'Assistance Technique',
  'Autre demande',
];

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  WAITING_CUSTOMER: 'En attente de votre réponse',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé',
};

export default function SupportPage() {
  const { can } = useSellerAccess();
  const canWrite = can('orders.write');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const data = await SellerService.getMySupportTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erreur chargement tickets support:', err);
      setFeedback({ type: 'error', message: 'Impossible de charger vos demandes d’assistance.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    try {
      setSubmitting(true);
      await SellerService.createSupportTicket({ category, subject, message });
      setFeedback({ type: 'success', message: 'Votre ticket a été transmis à l’équipe support MandeMarket.' });
      setShowCreate(false);
      setSubject('');
      setMessage('');
      await fetchTickets();
    } catch (err: any) {
      console.error('Erreur création ticket:', err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de l’envoi de votre demande.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SellerPageHeader
        title="Support MandeMarket"
        description="Assistance dédiée aux vendeurs. Notre équipe opérationnelle et technique répond à toutes vos questions."
        action={canWrite ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm transition flex items-center gap-1.5"
          >
            + Nouvelle demande
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

      {/* Formulaire de création de ticket */}
      {canWrite && showCreate && (
        <SellerCard title="Ouvrir un ticket d'assistance">
          <form onSubmit={handleCreateTicket} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie de la demande</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Objet / Sujet</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Problème de confirmation de livraison sur commande #A48"
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description détaillée</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Expliquez la situation avec un maximum de détails (numéros de commandes, dates, références d'articles)..."
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm disabled:opacity-50 transition"
              >
                {submitting ? 'Transmission...' : 'Envoyer la demande'}
              </button>
            </div>
          </form>
        </SellerCard>
      )}

      {/* Liste des tickets */}
      <SellerCard title="Historique de vos tickets">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : tickets.length === 0 ? (
          <SellerEmptyState
            title="Aucun ticket d'assistance"
            description="Vous n'avez soumis aucun ticket pour le moment. Besoin d'aide ? Cliquez sur '+ Nouvelle demande'."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((t) => (
              <div key={t.id} className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-navy">{t.reference || `#${String(t.id).slice(0, 8)}`}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      t.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {t.category}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{t.subject}</p>
                  <p className="text-xs text-gray-400">
                    Ouvert le {new Date(t.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(t)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition"
                  >
                    Voir le fil ({t.responses?.length ? t.responses.length + 1 : 1})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SellerCard>

      {/* Modal Détail Ticket */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy">
                  Ticket {selectedTicket.reference || `#${String(selectedTicket.id).slice(0, 8)}`} — {selectedTicket.category}
                </h3>
                <p className="text-xs text-gray-400">
                  {new Date(selectedTicket.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Message initial du vendeur */}
              <div className="bg-orange-50/50 border border-orange-100 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-brand-navy">
                  <span>Vous (Boutique)</span>
                  <span className="text-gray-400 font-normal">
                    {new Date(selectedTicket.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{selectedTicket.subject}</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{selectedTicket.message}</p>
              </div>

              {/* Réponses de l'équipe support */}
              {(selectedTicket.responses || []).map((resp: any, idx: number) => (
                <div key={resp.id || idx} className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
                    <span>{resp.author?.name || resp.author?.email || 'Support MandeMarket'}</span>
                    <span className="text-gray-400 font-normal">
                      {resp.createdAt ? new Date(resp.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{resp.message}</p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
