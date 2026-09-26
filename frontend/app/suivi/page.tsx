'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TruckIcon, MagnifyingGlassIcon, CheckCircleIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import api from '../config/api';

interface TrackingData {
  trackingCode: string;
  status: string;
  carrier: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  orderStatus?: string;
}

function TrackingContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams?.get('code') || '';
  const [trackingNumber, setTrackingNumber] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackingData | null>(null);

  const fetchTracking = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/shipping/track/${encodeURIComponent(code.trim())}`);
      setData(res as TrackingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aucun colis trouvé avec ce numéro de suivi.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      fetchTracking(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(trackingNumber);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 text-brand-orange mb-4">
          <TruckIcon className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900">Suivi de votre livraison</h1>
        <p className="mt-2 text-base text-gray-600">
          Saisissez le numéro de suivi de votre colis pour suivre son acheminement en temps réel.
        </p>
      </div>

      {/* Search bar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <MagnifyingGlassIcon className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Ex: LD-AF-1A2B3C ou 9V0001234567"
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange focus:border-brand-orange text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-orange hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span>Recherche...</span>
              </>
            ) : (
              'Suivre mon colis'
            )}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm mb-8 text-center">
          {error}
        </div>
      )}

      {/* Tracking details */}
      {data && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-100">Numéro de suivi</p>
              <p className="text-xl font-black font-mono mt-0.5">{data.trackingCode}</p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-sm font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
              {data.status === 'DELIVERED' ? 'Livré' : data.status === 'SHIPPED' || data.status === 'IN_TRANSIT' ? 'En transit' : 'En préparation'}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Transporteur</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{data.carrier || 'Transporteur certifié'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Statut de livraison</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{data.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Délai estimé</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{data.estimatedDelivery || '2-5 jours ouvrés'}</p>
              </div>
            </div>

            {/* Progress timeline */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              <div className="relative flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 -ml-6 border-2 border-white">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Commande validée et transmise au vendeur</p>
                  <p className="text-xs text-gray-500">Préparation en entrepôt ou atelier marchand</p>
                </div>
              </div>

              <div className="relative flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full ${data.status !== 'PENDING' ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'} flex items-center justify-center flex-shrink-0 -ml-6 border-2 border-white`}>
                  <ClockIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Prise en charge par le transporteur</p>
                  <p className="text-xs text-gray-500">{data.status !== 'PENDING' ? 'Colis confié au réseau logistique' : 'En attente de prise en charge'}</p>
                </div>
              </div>

              <div className="relative flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full ${data.status === 'DELIVERED' ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'} flex items-center justify-center flex-shrink-0 -ml-6 border-2 border-white`}>
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Livraison finale</p>
                  <p className="text-xs text-gray-500">{data.status === 'DELIVERED' ? 'Colis livré avec succès' : 'Remise contre signature ou point de retrait'}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <Link
                href="/compte/dashboard"
                className="text-sm font-semibold text-brand-orange hover:text-orange-700"
              >
                Accéder à l'historique complet dans mon compte &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={
        <div className="text-center py-12 text-gray-500">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-orange" />
          <p>Chargement du suivi...</p>
        </div>
      }>
        <TrackingContent />
      </Suspense>
    </div>
  );
}
