'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard, SellerEmptyState } from '../../_components/ui';

function MessagesContent() {
  const searchParams = useSearchParams();
  const prefilledCustomer = searchParams?.get('customer') || '';

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    SellerService.getMyCustomers()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCustomers(list);
        if (prefilledCustomer) {
          const matched = list.find((c) => c.email.toLowerCase() === prefilledCustomer.toLowerCase());
          if (matched) {
            setSelectedCustomer(matched);
            setSubject(`À propos de votre commande récente`);
          } else {
            setSelectedCustomer(null);
            setFeedback({ type: 'error', message: 'Ce client ne fait pas partie des acheteurs de votre boutique.' });
          }
        }
      })
      .catch((err) => {
        console.error('Erreur chargement clients:', err);
      })
      .finally(() => setLoading(false));
  }, [prefilledCustomer]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer?.email || !content.trim()) return;

    try {
      setSending(true);
      await SellerService.sendMessageToCustomer({
        customerEmail: selectedCustomer.email,
        subject: subject.trim() || 'Message de votre vendeur MandeMarket',
        content: content.trim(),
      });
      setFeedback({ type: 'success', message: `Email envoyé à ${selectedCustomer.name || selectedCustomer.email} avec succès.` });
      setContent('');
      setSubject('');
    } catch (err: any) {
      console.error('Erreur envoi message:', err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de l’envoi du message.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <SellerPageHeader
        title="Messagerie clients"
        description="Communiquez directement avec les acheteurs ayant commandé des articles dans votre boutique."
      />

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des acheteurs de la boutique */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-bold text-brand-navy">Clients récents</h3>
          <SellerCard>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : customers.length === 0 ? (
              <SellerEmptyState
                title="Aucun client"
                description="Vos acheteurs apparaîtront ici dès leurs premières commandes."
              />
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {customers.map((c) => {
                  const isSelected = selectedCustomer?.email === c.email;
                  return (
                    <button
                      key={c.id || c.email}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setSubject(`À propos de votre commande #${c.lastOrderNumber || ''}`);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition text-xs flex flex-col gap-1 ${
                        isSelected ? 'bg-brand-orange/10 border-l-4 border-brand-orange' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-bold text-gray-900">{c.name}</span>
                      <span className="text-gray-500">{c.email}</span>
                      {c.lastOrderNumber && (
                        <span className="text-[11px] text-gray-400">
                          Dernière commande : #{c.lastOrderNumber} ({new Date(c.lastOrderDate).toLocaleDateString('fr-FR')})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </SellerCard>
        </div>

        {/* Espace de composition de message */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-bold text-brand-navy">
            {selectedCustomer ? `Écrire à ${selectedCustomer.name || selectedCustomer.email}` : 'Sélectionnez un client'}
          </h3>
          <SellerCard>
            {selectedCustomer ? (
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-500 font-medium">Destinataire : </span>
                    <strong className="text-brand-navy">{selectedCustomer.name}</strong> ({selectedCustomer.email})
                  </div>
                  {selectedCustomer.phone && (
                    <span className="text-gray-500">📞 {selectedCustomer.phone}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Objet du message</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Information importante concernant la préparation de votre colis"
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Corps du message</label>
                  <textarea
                    required
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Bonjour, nous vous informons que votre commande est en cours de préparation dans nos ateliers..."
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={sending || !content.trim()}
                    className="px-6 py-2.5 text-xs font-bold rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90 shadow-sm disabled:opacity-50 transition"
                  >
                    {sending ? 'Transmission...' : '✉️ Envoyer le message'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-16 text-center text-sm text-gray-400">
                Sélectionnez un client dans la liste de gauche pour composer un message.
              </div>
            )}
          </SellerCard>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" /></div>}>
      <MessagesContent />
    </Suspense>
  );
}
