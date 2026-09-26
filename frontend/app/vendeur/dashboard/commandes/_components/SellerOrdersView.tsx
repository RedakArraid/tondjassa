'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerCard, SellerEmptyState } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

function fmt(cents: number) {
  return `${Math.round((cents || 0) / 100).toLocaleString('fr-FR')} FCFA`;
}

interface SellerOrdersViewProps {
  title: string;
  description: string;
  presetStatus?: string;
}

export default function SellerOrdersView({ title, description, presetStatus }: SellerOrdersViewProps) {
  const { can } = useSellerAccess();
  const canWrite = can('orders.write');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState(presetStatus || 'ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const statusParam = activeStatus === 'ALL' ? undefined : (activeStatus.includes(',') ? undefined : activeStatus);
      const res = await SellerService.getMyOrders(1, 100, statusParam, search || undefined);
      let list = res?.orders || [];
      if (activeStatus !== 'ALL' && activeStatus.includes(',')) {
        const set = new Set(activeStatus.split(','));
        list = list.filter((o: any) => set.has(String(o.status || '').toUpperCase()));
      }
      setOrders(list);
    } catch (err: any) {
      console.error('Erreur chargement commandes:', err);
      setFeedback({ type: 'error', message: 'Impossible de charger vos commandes.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: string, details?: { trackingNumber?: string; carrierName?: string }) => {
    try {
      setActionLoading(orderId);
      await SellerService.updateMyOrderStatus(orderId, nextStatus, details);
      setFeedback({ type: 'success', message: `Commande mise à jour vers le statut : ${nextStatus}` });
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev: any) => ({ ...prev, status: nextStatus }));
      }
    } catch (err: any) {
      console.error('Erreur update statut:', err);
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la mise à jour de la commande.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrintPackingSlip = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      const slip = await SellerService.getPackingSlip(orderId);
      const printWindow = window.open('', '_blank', 'width=800,height=900');
      if (!printWindow) {
        alert('Veuillez autoriser les fenêtres pop-up pour imprimer le bordereau.');
        return;
      }
      const itemsHtml = (slip.items || []).map((it: any) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 8px;"><strong>${it.name}</strong><br><small style="color:#6b7280;">SKU: ${it.sku}</small></td>
          <td style="padding: 10px 8px; text-align: center;">${it.quantity}</td>
          <td style="padding: 10px 8px; text-align: right;">${Math.round((it.unitPrice || 0) / 100).toLocaleString('fr-FR')} FCFA</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: bold;">${Math.round((it.totalPrice || 0) / 100).toLocaleString('fr-FR')} FCFA</td>
        </tr>
      `).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bordereau de livraison - #${slip.order?.orderNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; padding: 40px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
            .badge { background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px; }
            .section { margin-bottom: 24px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .card { background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { text-align: left; padding: 10px 8px; background: #f3f4f6; font-size: 13px; text-transform: uppercase; color: #4b5563; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print()" style="background: #ea580c; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">🖨️ Imprimer ce document</button>
          </div>
          <div class="header">
            <div>
              <h1 class="title">MANDEMARKET</h1>
              <p style="color: #6b7280; margin: 4px 0 0 0;">Bordereau de préparation & livraison</p>
            </div>
            <div style="text-align: right;">
              <p style="font-weight: bold; margin: 0;">Commande #${slip.order?.orderNumber}</p>
              <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0;">Date: ${new Date(slip.order?.date).toLocaleDateString('fr-FR')}</p>
              <span class="badge">Statut: ${slip.order?.status}</span>
            </div>
          </div>

          <div class="grid section">
            <div class="card">
              <strong style="color: #374151;">Boutique Vendeur</strong>
              <p style="margin: 6px 0 0 0; font-size: 15px; font-weight: 600;">${slip.store?.name}</p>
              <p style="margin: 2px 0 0 0; font-size: 13px; color: #6b7280;">Boutique: ${slip.store?.slug}</p>
              ${slip.store?.contact ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #6b7280;">Email: ${slip.store.contact}</p>` : ''}
            </div>
            <div class="card">
              <strong style="color: #374151;">Destinataire Client</strong>
              <p style="margin: 6px 0 0 0; font-size: 15px; font-weight: 600;">${slip.recipient?.name || 'Client MandeMarket'}</p>
              ${slip.recipient?.phone ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #6b7280;">Tél: ${slip.recipient.phone}</p>` : ''}
              <p style="margin: 2px 0 0 0; font-size: 13px; color: #6b7280;">
                ${slip.recipient?.address?.street || ''}, ${slip.recipient?.address?.city || ''} ${slip.recipient?.address?.country || ''}
              </p>
            </div>
          </div>

          <div class="section">
            <h3 style="margin-bottom: 8px;">Articles à préparer (${slip.totalQuantity} unités)</h3>
            <table>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th style="text-align: center;">Quantité</th>
                  <th style="text-align: right;">Prix unitaire</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>MandeMarket Marketplace · Document officiel de préparation et d'expédition.</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      console.error('Erreur impression bordereau:', err);
      setFeedback({ type: 'error', message: 'Erreur lors de la génération du bordereau.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportCsv = () => {
    if (orders.length === 0) {
      alert('Aucune commande à exporter.');
      return;
    }
    const headers = ['Numero Commande', 'Date', 'Client', 'Telephone', 'Statut', 'Articles Vendeur', 'Montant Vendeur (FCFA)', 'Gains Vendeur (FCFA)'];
    const rows = orders.map((o) => [
      `"${o.orderNumber || o.id}"`,
      `"${new Date(o.createdAt).toLocaleDateString('fr-FR')}"`,
      `"${o.customer?.firstName || ''} ${o.customer?.lastName || ''}"`,
      `"${o.customer?.phone || ''}"`,
      `"${o.status}"`,
      `"${(o.items || []).map((it: any) => `${it.product?.name || 'Article'} (x${it.quantity})`).join('; ')}"`,
      Math.round((o.sellerTotal || o.totalAmount || 0) / 100),
      Math.round((o.sellerEarnings || o.sellerTotal || 0) / 100),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `commandes-mandemarket-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Livrée</span>;
      case 'SHIPPED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Expédiée</span>;
      case 'PROCESSING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">En préparation</span>;
      case 'PENDING':
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">À préparer</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Annulée</span>;
      case 'REFUNDED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Remboursée</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-5">
      <SellerPageHeader
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm transition flex items-center gap-1.5"
            >
              📥 Exporter CSV
            </button>
            <button
              type="button"
              onClick={fetchOrders}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm transition"
            >
              🔄 Actualiser
            </button>
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

      {/* Barre de recherche et onglets de filtres */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'ALL', label: 'Toutes' },
            { key: 'PENDING,CONFIRMED,PROCESSING', label: 'À préparer' },
            { key: 'SHIPPED', label: 'Expédiées' },
            { key: 'DELIVERED', label: 'Livrées' },
            { key: 'CANCELLED', label: 'Annulées' },
            { key: 'REFUNDED', label: 'Retours' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveStatus(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeStatus === tab.key
                  ? 'bg-brand-orange text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° commande ou client..."
            className="px-3.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-orange/30 w-full md:w-56"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90"
          >
            Rechercher
          </button>
        </form>
      </div>

      {/* Liste des commandes */}
      <SellerCard>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : orders.length === 0 ? (
          <SellerEmptyState
            title="Aucune commande trouvée"
            description="Aucune commande ne correspond aux filtres actuels."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((o) => {
              const orderStatus = String(o.status || '').toUpperCase();
              const isOrderActionLoading = actionLoading === o.id;

              return (
                <div key={o.id} className="py-4 first:pt-0 last:pb-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-brand-navy">
                        #{o.orderNumber || String(o.id).slice(0, 8)}
                      </span>
                      {getStatusBadge(o.status)}
                      <span className="text-xs text-gray-400">
                        {new Date(o.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600">
                      Client : <span className="font-medium text-gray-800">{o.customer?.firstName} {o.customer?.lastName}</span>
                      {o.customer?.phone && <span className="text-gray-400"> ({o.customer.phone})</span>}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>Montant articles : <strong className="text-brand-navy">{fmt(o.sellerTotal || o.totalAmount)}</strong></span>
                      {o.sellerEarnings && <span>Gains crédités : <strong className="text-emerald-700">{fmt(o.sellerEarnings)}</strong></span>}
                      <span>· {o.items?.length || 0} article(s)</span>
                    </div>

                    {/* Aperçu des articles */}
                    {o.items && o.items.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-2">
                        {o.items.map((item: any) => (
                          <span key={item.id} className="inline-flex items-center text-xs bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-700">
                            {item.product?.name || 'Article'} (x{item.quantity})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions réelles de gestion logistique */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(o)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition"
                    >
                      Détails
                    </button>

                    <button
                      type="button"
                      disabled={isOrderActionLoading}
                      onClick={() => handlePrintPackingSlip(o.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition"
                    >
                      🖨️ Bordereau
                    </button>

                    {/* Actions de statut dynamiques selon l'étape */}
                    {canWrite && (orderStatus === 'PENDING' || orderStatus === 'CONFIRMED') && (
                      <button
                        type="button"
                        disabled={isOrderActionLoading}
                        onClick={() => handleUpdateStatus(o.id, 'PROCESSING')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition"
                      >
                        {isOrderActionLoading ? '...' : 'Préparer'}
                      </button>
                    )}

                    {canWrite && orderStatus === 'PROCESSING' && (
                      <button
                        type="button"
                        disabled={isOrderActionLoading}
                        onClick={() => {
                          const tracking = window.prompt('Numéro de suivi du transporteur (facultatif) :') || undefined;
                          handleUpdateStatus(o.id, 'SHIPPED', { trackingNumber: tracking });
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                      >
                        {isOrderActionLoading ? '...' : '🚚 Expédier'}
                      </button>
                    )}

                    {canWrite && orderStatus === 'SHIPPED' && (
                      <button
                        type="button"
                        disabled={isOrderActionLoading}
                        onClick={() => {
                          if (window.confirm('Confirmez-vous que le client a bien reçu ses articles ? Cette action débloque les fonds selon les conditions de retour.')) {
                            handleUpdateStatus(o.id, 'DELIVERED');
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                      >
                        {isOrderActionLoading ? '...' : '✓ Confirmer livraison'}
                      </button>
                    )}

                    {canWrite && <Link
                      href={`/vendeur/dashboard/communication/messages?customer=${encodeURIComponent(o.customer?.email || '')}`}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg text-brand-navy hover:bg-brand-navy/5 transition"
                    >
                      💬 Message
                    </Link>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SellerCard>

      {/* Modal Détails Commande */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-brand-navy">
                  Commande #{selectedOrder.orderNumber || selectedOrder.id}
                </h3>
                <p className="text-xs text-gray-500">
                  Créée le {new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase">Informations client</p>
                <p className="font-semibold text-brand-navy mt-1">
                  {selectedOrder.customer?.firstName} {selectedOrder.customer?.lastName}
                </p>
                <p className="text-xs text-gray-600">{selectedOrder.customer?.email}</p>
                <p className="text-xs text-gray-600">{selectedOrder.customer?.phone || 'Pas de numéro fourni'}</p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase">Adresse de livraison</p>
                <p className="mt-1 text-gray-800">
                  {selectedOrder.shippingAddress ? (
                    <>
                      {selectedOrder.shippingAddress.street}<br />
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.country}
                    </>
                  ) : (
                    'Adresse standard'
                  )}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-brand-navy mb-2">Vos articles dans cette commande</p>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
                {(selectedOrder.items || []).map((item: any) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{item.product?.name || 'Article'}</p>
                      <p className="text-xs text-gray-400">SKU: {item.product?.sku || 'N/A'} · Quantité : {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-brand-navy">{fmt(item.totalPrice)}</p>
                      <p className="text-xs text-emerald-600">Net vendeur: {fmt(item.sellerEarnings || item.totalPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintPackingSlip(selectedOrder.id)}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-800 flex items-center gap-1.5"
                >
                  🖨️ Imprimer bordereau
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
