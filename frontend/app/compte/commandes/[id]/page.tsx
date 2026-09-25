'use client';

import { apiFetch as fetch } from '../../../lib/api-fetch';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCustomerAuth } from '../../../contexts/CustomerAuthContext';
import PublicHeader from '../../../components/PublicHeader';
import PublicFooter from '../../../components/PublicFooter';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  TruckIcon,
  CreditCardIcon,
  MapPinIcon,
  ShoppingBagIcon,
  ClockIcon,
  ArrowUturnLeftIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'En attente', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  CONFIRMED: { label: 'Confirmée', color: 'text-blue-700', bg: 'bg-blue-100' },
  PROCESSING: { label: 'En traitement', color: 'text-violet-700', bg: 'bg-violet-100' },
  SHIPPED: { label: 'Expédiée', color: 'text-orange-700', bg: 'bg-orange-100' },
  DELIVERED: { label: 'Livrée', color: 'text-green-700', bg: 'bg-green-100' },
  CANCELLED: { label: 'Annulée', color: 'text-red-700', bg: 'bg-red-100' },
  REFUNDED: { label: 'Remboursée', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const STEP_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PROCESSING: 'Traitement',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
};

interface ProductInfo {
  id: number;
  name: string;
  image?: string;
  price: number;
}

interface SellerInfo {
  id: string;
  storeName: string;
  slug: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  product: ProductInfo;
  seller?: SellerInfo | null;
}

interface Address {
  street: string;
  city: string;
  postalCode?: string;
  country?: string;
}

interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: Address | null;
}

interface Payment {
  method: string;
  status: string;
}

interface Shipping {
  method?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  shippingAmount?: number;
  discountAmount?: number;
  createdAt: string;
  customer?: CustomerInfo | null;
  items: OrderItem[];
  payment?: Payment | null;
  shipping?: Shipping | null;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  const { isAuthenticated, isLoading } = useCustomerAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnModal, setReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnDesc, setReturnDesc] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState(false);
  const [returnError, setReturnError] = useState('');

  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/compte/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !orderId) return;
    const fetchOrder = async () => {
      const token = localStorage.getItem('mandemarket_customer_token');
      try {
        const res = await fetch(`${API}/api/account/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Commande introuvable');
        }
        const data = await res.json();
        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur serveur');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [isAuthenticated, orderId]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
        <PublicHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
        <PublicHeader />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-700 mb-2">{error || 'Commande introuvable'}</p>
          <Link href="/compte/commandes" className="mt-4 inline-block text-orange-600 hover:text-orange-700 font-semibold">
            Retour aux commandes
          </Link>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelLoading(true);
    setCancelError('');
    const token = localStorage.getItem('mandemarket_customer_token');
    try {
      const res = await fetch(`${API}/api/account/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || 'Erreur lors de l’annulation');
        return;
      }
      setOrder(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
      setCancelModal(false);
    } catch {
      setCancelError('Impossible de contacter le serveur.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnReason.trim()) { setReturnError('Veuillez indiquer une raison.'); return; }
    setReturnLoading(true);
    setReturnError('');
    const token = localStorage.getItem('mandemarket_customer_token');
    try {
      const res = await fetch(`${API}/api/account/orders/${orderId}/return-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: returnReason, description: returnDesc }),
      });
      const data = await res.json();
      if (!res.ok) { setReturnError(data.error || 'Erreur lors de la soumission'); return; }
      setReturnSuccess(true);
    } catch { setReturnError('Impossible de contacter le serveur.'); }
    finally { setReturnLoading(false); }
  };

  const handlePrintInvoice = () => {
    const win = window.open('', '_blank');
    if (!win || !order) return;
    const subtotalFCFA = Math.round(order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) / 100);
    const rows = order.items.map(item => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${item.product?.name || 'Produit'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${Math.round(item.unitPrice / 100).toLocaleString()} FCFA</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${Math.round(item.unitPrice * item.quantity / 100).toLocaleString()} FCFA</td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Facture #${order.id.substring(0,8).toUpperCase()}</title>
      <style>body{font-family:sans-serif;margin:40px;color:#111}table{width:100%;border-collapse:collapse}th{background:#1A8F5C;color:white;padding:8px;text-align:left}tfoot td{font-weight:bold}</style>
    </head><body>
      <h1 style="color:#1A8F5C">MandeMarket</h1>
      <p style="color:#666">Facture #${order.id.substring(0,8).toUpperCase()} · ${new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
      <hr/>
      <p><strong>Client :</strong> ${order.customer?.firstName || ''} ${order.customer?.lastName || ''}<br/>
         <strong>Email :</strong> ${order.customer?.email || ''}</p>
      <table><thead><tr><th>Produit</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3" style="padding:8px;text-align:right">Total</td><td style="padding:8px;text-align:right">${Math.round(order.totalAmount / 100).toLocaleString()} FCFA</td></tr></tfoot>
      </table>
      <p style="margin-top:40px;color:#999;font-size:12px">Merci pour votre achat sur MandeMarket.</p>
      <script>window.print();</script>
    </body></html>`);
    win.document.close();
  };

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const statusInfo = STATUS_INFO[order.status] || STATUS_INFO['PENDING'];

  const subtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shipping = order.shippingAmount ?? 0;
  const discount = order.discountAmount ?? 0;
  const total = order.totalAmount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
      <PublicHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/compte/commandes"
            className="p-2 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors text-gray-600 hover:text-orange-600"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                Commande #{order.id.substring(0, 8).toUpperCase()}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              {new Date(order.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handlePrintInvoice}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors"
            >
              <PrinterIcon className="w-4 h-4" />
              Facture
            </button>
            {['PENDING', 'CONFIRMED'].includes(order.status) && (
              <button
                onClick={() => { setCancelReason(''); setCancelError(''); setCancelModal(true); }}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 bg-red-50/50 rounded-lg text-sm text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors font-medium"
              >
                Annuler la commande
              </button>
            )}
            {order.status === 'DELIVERED' && !returnSuccess && (
              <button
                onClick={() => setReturnModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors"
              >
                <ArrowUturnLeftIcon className="w-4 h-4" />
                Retour
              </button>
            )}
            {returnSuccess && (
              <span className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                <CheckCircleIcon className="w-4 h-4" />
                Retour demandé
              </span>
            )}
          </div>
        </div>

        {/* Timeline (Stepper) */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-base font-bold text-gray-900 mb-6">Suivi de la commande</h2>
            <div className="relative">
              {/* Ligne de progression */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
              <div
                className="absolute top-5 left-0 h-0.5 bg-orange-500 transition-all duration-500"
                style={{
                  width: currentStepIndex >= 0
                    ? `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%`
                    : '0%',
                }}
              />
              {/* Etapes */}
              <div className="relative flex justify-between">
                {STATUS_STEPS.map((step, idx) => {
                  const done = idx <= currentStepIndex;
                  const active = idx === currentStepIndex;
                  return (
                    <div key={step} className="flex flex-col items-center gap-2">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                          done
                            ? 'bg-orange-500 border-orange-500'
                            : 'bg-white border-gray-300'
                        } ${active ? 'ring-4 ring-orange-200' : ''}`}
                      >
                        {done ? (
                          <CheckCircleIconSolid className="w-5 h-5 text-white" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-300" />
                        )}
                      </div>
                      <span className={`text-xs font-medium text-center hidden sm:block ${done ? 'text-orange-600' : 'text-gray-400'}`}>
                        {STEP_LABELS[step]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche - Articles */}
          <div className="lg:col-span-2 space-y-6">
            {/* Articles */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingBagIcon className="w-5 h-5 text-orange-500" />
                Articles commandés ({order.items.length})
              </h2>
              <div className="space-y-4">
                {order.items.map((item) => {
                  const itemTotal = Math.round((item.unitPrice * item.quantity) / 100);
                  const unitFCFA = Math.round(item.unitPrice / 100);
                  return (
                    <div key={item.id} className="flex items-start gap-4 p-3 rounded-xl bg-gray-50">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                        <img
                          src={item.product?.image || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=100&h=100&fit=crop'}
                          alt={item.product?.name || 'Produit'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=100&h=100&fit=crop';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{item.product?.name || 'Produit'}</p>
                        {item.seller && (
                          <p className="text-xs text-gray-500 mt-0.5">Vendeur: {item.seller.storeName}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {item.quantity} × {unitFCFA.toLocaleString()} FCFA
                        </p>
                      </div>
                      <p className="font-bold text-gray-900 text-sm flex-shrink-0">
                        {itemTotal.toLocaleString()} FCFA
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Paiement */}
            {order.payment && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCardIcon className="w-5 h-5 text-orange-500" />
                  Paiement
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">Méthode</p>
                    <p className="font-semibold text-gray-900 text-sm capitalize">
                      {order.payment.method?.replace(/_/g, ' ') || '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">Statut</p>
                    <p className={`font-semibold text-sm capitalize ${
                      order.payment.status === 'paid' ? 'text-green-600' :
                      order.payment.status === 'pending' ? 'text-yellow-600' : 'text-gray-700'
                    }`}>
                      {order.payment.status || '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Livraison */}
            {order.shipping && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TruckIcon className="w-5 h-5 text-orange-500" />
                  Livraison
                </h2>
                <div className="space-y-3">
                  {order.shipping.method && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Méthode</span>
                      <span className="font-medium text-gray-900 capitalize">{order.shipping.method.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {order.shipping.trackingNumber && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Numéro de suivi</span>
                      <span className="font-mono font-semibold text-orange-600">{order.shipping.trackingNumber}</span>
                    </div>
                  )}
                  {order.shipping.estimatedDelivery && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Livraison estimée</span>
                      <span className="font-medium text-gray-900">
                        {new Date(order.shipping.estimatedDelivery).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite */}
          <div className="space-y-6">
            {/* Adresse de livraison */}
            {order.customer?.address && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-orange-500" />
                  Adresse de livraison
                </h2>
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="font-semibold">
                    {order.customer?.firstName} {order.customer?.lastName}
                  </p>
                  <p>{order.customer.address.street}</p>
                  <p>{order.customer.address.city}{order.customer.address.postalCode ? `, ${order.customer.address.postalCode}` : ''}</p>
                  {order.customer.address.country && <p>{order.customer.address.country}</p>}
                  {order.customer.phone && <p className="text-gray-500">{order.customer.phone}</p>}
                </div>
              </div>
            )}

            {/* Récapitulatif prix */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Récapitulatif</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Sous-total</span>
                  <span className="font-medium">{Math.round(subtotal / 100).toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Frais de port</span>
                  <span className={`font-medium ${shipping === 0 ? 'text-green-600' : ''}`}>
                    {shipping === 0 ? 'Gratuit' : `${Math.round(shipping / 100).toLocaleString()} FCFA`}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Réduction</span>
                    <span className="font-medium">-{Math.round(discount / 100).toLocaleString()} FCFA</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900 text-base">Total</span>
                  <span className="font-bold text-orange-600 text-base">
                    {Math.round(total / 100).toLocaleString()} FCFA
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Return request modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setReturnModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ArrowUturnLeftIcon className="w-5 h-5 text-orange-500" />
              Demande de retour
            </h2>
            {returnSuccess ? (
              <div className="text-center py-4">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">Votre demande a été envoyée.</p>
                <p className="text-sm text-gray-500 mt-1">Notre équipe vous contactera sous 48h.</p>
                <button onClick={() => setReturnModal(false)} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">Fermer</button>
              </div>
            ) : (
              <form onSubmit={handleReturnSubmit} className="space-y-4">
                {returnError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{returnError}</div>}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Raison du retour *</label>
                  <select
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    required
                  >
                    <option value="">Sélectionner une raison</option>
                    <option value="Produit défectueux">Produit défectueux</option>
                    <option value="Produit non conforme">Produit non conforme à la description</option>
                    <option value="Mauvaise taille">Mauvaise taille / dimensions</option>
                    <option value="Commande incorrecte">Produit incorrect reçu</option>
                    <option value="Autre">Autre raison</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Détails <span className="font-normal text-gray-400">(optionnel)</span></label>
                  <textarea
                    value={returnDesc}
                    onChange={e => setReturnDesc(e.target.value)}
                    rows={3}
                    placeholder="Décrivez le problème..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setReturnModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">Annuler</button>
                  <button type="submit" disabled={returnLoading} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-60">
                    {returnLoading ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Cancel order modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setCancelModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Annuler cette commande ?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Cette action est irréversible. Les articles seront remis en stock et votre commande passera au statut annulé.
            </p>
            {cancelError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {cancelError}
              </div>
            )}
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Motif d'annulation <span className="font-normal text-gray-400">(optionnel)</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  rows={2}
                  placeholder="Ex: Changement d'avis, erreur de sélection..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none text-sm"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setCancelModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Ne pas annuler
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-60"
                >
                  {cancelLoading ? 'Annulation...' : 'Confirmer l’annulation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
