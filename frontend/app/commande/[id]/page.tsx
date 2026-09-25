'use client';

import { apiFetch as fetch } from '../../lib/api-fetch';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import {
  CheckCircleIcon,
  ShoppingBagIcon,
  HomeIcon,
  PhoneIcon,
  EnvelopeIcon,
  TruckIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: { name: string; image?: string };
}

interface OrderData {
  id: string;
  orderNumber?: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  notes?: string;
  items: OrderItem[];
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: { street: string; city: string; country: string };
  };
  payment?: { method: string; status: string };
  shipping?: { carrier: string; status: string; estimatedDelivery?: string };
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:    { label: 'En attente',    color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '⏳' },
  CONFIRMED:  { label: 'Confirmée',     color: 'text-green-600 bg-green-50 border-green-200',   icon: '✅' },
  PROCESSING: { label: 'En préparation',color: 'text-blue-600 bg-blue-50 border-blue-200',      icon: '📦' },
  SHIPPED:    { label: 'Expédiée',      color: 'text-purple-600 bg-purple-50 border-purple-200',icon: '🚚' },
  DELIVERED:  { label: 'Livrée',        color: 'text-green-700 bg-green-100 border-green-300',  icon: '🎉' },
  CANCELLED:  { label: 'Annulée',       color: 'text-red-600 bg-red-50 border-red-200',         icon: '❌' },
};

const PAYMENT_LABELS: Record<string, string> = {
  mtn_momo:      'MTN Mobile Money',
  orange_money:  'Orange Money',
  wave:          'Wave',
  moov_money:    'Moov Money',
  cash_on_delivery: 'Paiement à la livraison',
  stripe:        'Carte bancaire / SEPA',
  paystack:      'Mobile Money / Carte',
  CARD:          'Paiement en ligne',
  CASH_ON_DELIVERY: 'Paiement à la livraison',
};

function formatFCFA(centimes: number) {
  return `${Math.round(centimes / 100).toLocaleString('fr-FR')} FCFA`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
    fetch(`${API}/api/orders/reference/${orderId}`)
      .then(async (r) => {
        if (r.ok) return r.json();
        const r2 = await fetch(`${API}/api/account/orders/${orderId}`);
        if (!r2.ok) throw new Error('not found');
        return r2.json();
      })
      .then((data) => setOrder(data.order ?? data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [orderId]);

  const isCI = order?.customer?.address?.country === 'CI';
  const statusInfo = order ? (STATUS_LABELS[order.status] ?? STATUS_LABELS['PENDING']) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
      <PublicHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error || !order ? (
          <div role="alert" className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-12 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Commande inaccessible</h1>
            <p className="text-gray-600 mb-6">Impossible de consulter cette commande. Utilisez le lien de votre email de confirmation ou connectez-vous au compte qui a effectué l'achat.</p>
            <Link href="/compte/login" className="text-orange-700 font-semibold">Se connecter</Link>
            <p className="mt-4 text-sm text-gray-500">Aucun statut de commande ou de paiement ne peut être confirmé sur cette page.</p>
          </div>
        ) : (
          /* Commande chargée avec succès */
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-400 to-green-500 h-2" />
            <div className="p-8 sm:p-12">
              {/* Icone succès */}
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="w-14 h-14 text-green-500" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-400 rounded-full" />
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 text-center">
                {order.status === 'PENDING' ? 'Commande enregistrée' : 'Suivi de votre commande'}
              </h1>
              <p className="text-gray-500 text-center mb-6">
                {order.customer.firstName}, merci pour votre commande.
              </p>

              {/* Numéro + statut */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
                <div className="inline-flex flex-col items-center bg-orange-50 border-2 border-orange-200 rounded-2xl px-6 py-3">
                  <span className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-1">Commande</span>
                  <span className="text-lg font-bold text-orange-700 font-mono">#{order.orderNumber || order.id.slice(0, 8).toUpperCase()}</span>
                </div>
                {statusInfo && (
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${statusInfo.color}`}>
                    <span>{statusInfo.icon}</span>
                    {statusInfo.label}
                  </span>
                )}
              </div>

              {/* Articles commandés */}
              {order.items.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                  <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Articles</h2>
                  <div className="space-y-3">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                          <img
                            src={item.product.image ?? 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=80&h=80&fit=crop'}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                            onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=80&h=80&fit=crop'; }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.product.name}</p>
                          <p className="text-xs text-gray-500">Qté : {item.quantity}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-800">{formatFCFA(item.totalPrice)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 mt-4 pt-3 flex justify-between">
                    <span className="text-sm font-bold text-gray-700">Total</span>
                    <span className="text-sm font-bold text-orange-600">{formatFCFA(order.totalAmount)}</span>
                  </div>
                </div>
              )}

              {/* Infos livraison + paiement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {order.customer.address && (
                  <div className="bg-orange-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TruckIcon className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Livraison</span>
                    </div>
                    <p className="text-sm text-gray-700">{order.customer.address.street}</p>
                    <p className="text-sm text-gray-700">{order.customer.address.city}</p>
                    {order.shipping?.estimatedDelivery && (
                      <p className="text-xs text-gray-500 mt-1">
                        <ClockIcon className="w-3 h-3 inline mr-1" />
                        Estimée le {formatDate(order.shipping.estimatedDelivery)}
                      </p>
                    )}
                  </div>
                )}
                <div className="bg-blue-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">💳</span>
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Paiement</span>
                  </div>
                  {order.payment && (
                    <>
                      <p className="text-sm text-gray-700 font-medium">
                        {PAYMENT_LABELS[order.payment.method] ?? order.payment.method}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Statut :{' '}
                        <span className={order.payment.status === 'COMPLETED' ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                          {order.payment.status === 'COMPLETED' ? 'Payé' : order.payment.status === 'PENDING' ? 'En attente' : order.payment.status}
                        </span>
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Commande le {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>

              {/* Prochaines étapes */}
              <div className="bg-orange-50 rounded-2xl p-5 mb-6 space-y-3">
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Prochaines étapes</h2>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <EnvelopeIcon className="w-4 h-4 text-orange-600" />
                  </div>
                  <p className="text-sm text-gray-600">Un email de confirmation a été envoyé à <strong>{order.customer.email}</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <PhoneIcon className="w-4 h-4 text-orange-600" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Notre équipe vous contactera pour confirmer la livraison.
                    {isCI && order.customer.phone && (
                      <> Numéro enregistré : <strong>{order.customer.phone}</strong></>
                    )}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TruckIcon className="w-4 h-4 text-orange-600" />
                  </div>
                  <p className="text-sm text-gray-600">La livraison sera effectuée dans les délais indiqués lors du paiement.</p>
                </div>
              </div>

              {/* WhatsApp CI */}
              {isCI && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-4">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="text-sm font-bold text-green-800">Besoin d'aide ? Contactez-nous sur WhatsApp</p>
                    <a
                      href="https://wa.me/2250700000000"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-700 font-semibold underline"
                    >
                      +225 07 00 00 00 00
                    </a>
                    <span className="text-xs text-green-600 ml-2">· Lun–Sam, 8h–20h</span>
                  </div>
                </div>
              )}

              <ActionButtons orderId={orderId} isCI={isCI} />
            </div>
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}

function FallbackSteps() {
  return (
    <div className="bg-orange-50 rounded-2xl p-6 mb-8 text-left space-y-4">
      <h2 className="text-base font-bold text-gray-800 mb-3 text-center">Prochaines étapes</h2>
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <PhoneIcon className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Confirmation par téléphone</p>
          <p className="text-sm text-gray-500">Notre équipe vous contactera pour confirmer votre commande et convenir des modalités de livraison.</p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <EnvelopeIcon className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Confirmation par email</p>
          <p className="text-sm text-gray-500">Un email récapitulatif vous sera envoyé avec tous les détails de votre commande.</p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <TruckIcon className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Livraison</p>
          <p className="text-sm text-gray-500">La livraison sera effectuée à l'adresse indiquée dans les délais convenus.</p>
        </div>
      </div>
    </div>
  );
}

function ActionButtons({ orderId, isCI }: { orderId: string; isCI: boolean }) {
  return (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
        <Link
          href="/boutique"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-7 py-3.5 rounded-xl font-bold text-base hover:from-orange-600 hover:to-orange-700 shadow-lg transition-all w-full sm:w-auto justify-center"
        >
          <ShoppingBagIcon className="w-5 h-5" />
          Continuer les achats
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-white text-gray-700 border-2 border-gray-200 px-7 py-3.5 rounded-xl font-bold text-base hover:border-orange-400 hover:text-orange-600 transition-all w-full sm:w-auto justify-center"
        >
          <HomeIcon className="w-5 h-5" />
          Retour à l'accueil
        </Link>
      </div>
      {isCI && (
        <div className="mt-4 text-center">
          <a
            href="https://wa.me/2250700000000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-semibold"
          >
            📱 Nous contacter sur WhatsApp
          </a>
        </div>
      )}
      <p className="mt-6 text-sm text-gray-400 text-center">
        Des questions ?{' '}
        <Link href="/contact" className="text-orange-500 hover:text-orange-600 font-semibold">
          Contactez-nous
        </Link>
      </p>
    </>
  );
}
