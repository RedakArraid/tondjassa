'use client';

import { apiFetch as fetch } from '../../lib/api-fetch';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../contexts/CartContext';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import {
  CheckCircleIcon,
  ShoppingBagIcon,
  TruckIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface PaymentStatusResponse {
  orderId: string;
  orderNumber?: string;
  orderStatus: string;
  paymentStatus: string;
  isPaid: boolean;
  payment: {
    id: string;
    method: string;
    gateway: string;
    status: string;
    amount: number;
    transactionId?: string;
    updatedAt: string;
  } | null;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const orderId = searchParams?.get('orderId') ?? null;
  const [data, setData] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!orderId) {
      router.push('/boutique');
      return;
    }
    clearCart();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/payment/status/${orderId}`);
        if (!res.ok) throw new Error('Erreur vérification');
        const json: PaymentStatusResponse = await res.json();
        setData(json);

        // Si le paiement est encore en attente ou en cours, continuer le polling jusqu'à 5 fois
        if (!json.isPaid && json.paymentStatus !== 'FAILED' && pollCount < 5) {
          setTimeout(() => {
            setPollCount((prev) => prev + 1);
          }, 2000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Erreur status:', err);
        setLoading(false);
      }
    };

    checkStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, pollCount]);

  const displayOrderRef = data?.orderNumber || (orderId ? `#${orderId.substring(0, 8).toUpperCase()}` : '');
  const isConfirmed = data?.isPaid === true && data?.orderStatus !== 'CANCELLED';
  const isPending = !isConfirmed && (data?.paymentStatus === 'PENDING' || data?.paymentStatus === 'PROCESSING');
  const isFailed = data?.paymentStatus === 'FAILED' || data?.orderStatus === 'CANCELLED';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="flex justify-center mb-8">
        {loading || isPending ? (
          <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center animate-pulse">
            <ClockIcon className="w-14 h-14 text-yellow-600" />
          </div>
        ) : isConfirmed ? (
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircleIcon className="w-14 h-14 text-green-500" />
          </div>
        ) : (
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
            <XCircleIcon className="w-14 h-14 text-red-500" />
          </div>
        )}
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
        {loading
          ? 'Vérification du paiement...'
          : isConfirmed
          ? 'Paiement confirmé avec succès !'
          : isPending
          ? 'Paiement en cours de validation'
          : 'Paiement non complété'}
      </h1>

      <p className="text-gray-600 mb-6">
        {loading
          ? 'Nous interrogeons votre opérateur pour confirmer la transaction.'
          : isConfirmed
          ? 'Votre commande a été validée et transmise à nos équipes de préparation.'
          : isPending
          ? 'Votre opérateur traite votre paiement. Vous recevrez une notification dès validation.'
          : 'La transaction n’a pas abouti ou a été refusée.'}
      </p>

      {displayOrderRef && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-6 py-4 mb-8 inline-block">
          <p className="text-sm text-gray-500 mb-1">Référence commande</p>
          <p className="text-xl font-bold text-orange-600 tracking-wider">{displayOrderRef}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 mb-8 text-left space-y-3">
        <div className="flex items-center gap-3 text-gray-700">
          <TruckIcon className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <span className="text-sm">
            {isConfirmed
              ? 'Votre commande sera expédiée dans les plus brefs délais.'
              : 'La livraison débutera dès réception de la confirmation de paiement.'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-gray-700">
          <ShoppingBagIcon className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <span className="text-sm">Un email de confirmation récapitulatif vous a été envoyé.</span>
        </div>
        {data?.payment && (
          <div className="flex items-center gap-3 text-gray-700">
            <span className="text-sm font-medium">
              Statut du paiement :{' '}
              <span className={`font-semibold ${isConfirmed ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-yellow-600'}`}>
                {data.payment.status === 'COMPLETED'
                  ? 'Confirmé'
                  : data.payment.status === 'PROCESSING'
                  ? 'En cours de validation'
                  : data.payment.status === 'FAILED'
                  ? 'Échoué'
                  : 'En attente'}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {orderId && (
          <Link
            href={`/commande/${data?.orderNumber || orderId}`}
            className="py-3 px-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 shadow transition-all"
          >
            Suivre ma commande
          </Link>
        )}
        {isFailed && (
          <Link
            href="/checkout"
            className="py-3 px-6 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-all flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Réessayer le paiement
          </Link>
        )}
        <Link
          href="/boutique"
          className="py-3 px-6 bg-white border-2 border-orange-300 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-all"
        >
          Continuer les achats
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
      <PublicHeader />
      <Suspense fallback={<div className="py-24 text-center text-gray-400">Chargement...</div>}>
        <SuccessContent />
      </Suspense>
      <PublicFooter />
    </div>
  );
}
