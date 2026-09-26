'use client';

import { apiFetch as fetch } from '../../lib/api-fetch';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import {
  ShoppingBagIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  CONFIRMED: { label: 'Confirmée', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  PROCESSING: { label: 'En traitement', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  SHIPPED: { label: 'Expédiée', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  DELIVERED: { label: 'Livrée', color: 'bg-green-100 text-green-800 border-green-200' },
  CANCELLED: { label: 'Annulée', color: 'bg-red-100 text-red-800 border-red-200' },
  REFUNDED: { label: 'Remboursée', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

interface OrderItem {
  id: string;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const LIMIT = 10;

export default function CommandesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCustomerAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/compte/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchOrders = useCallback(async (p: number) => {
    const token = sessionStorage.getItem('mandemarket_customer_token');
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/account/orders?page=${p}&limit=${LIMIT}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des commandes');
      const data = await res.json();
      setOrders(data.orders || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders(page);
    }
  }, [isAuthenticated, page, fetchOrders]);

  if (isLoading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
      <PublicHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Titre */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/compte/dashboard"
            className="p-2 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors text-gray-600 hover:text-orange-600"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes commandes</h1>
            {pagination && (
              <p className="text-sm text-gray-500 mt-0.5">{pagination.total} commande{pagination.total > 1 ? 's' : ''} au total</p>
            )}
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Contenu */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-16">
            <ShoppingBagIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-xl font-bold text-gray-700 mb-2">Aucune commande</p>
            <p className="text-gray-500 text-sm mb-6">Vous n'avez pas encore passé de commande.</p>
            <Link
              href="/boutique"
              className="inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md"
            >
              Découvrir la boutique
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* En-tête tableau */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <div className="col-span-3">Commande</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-2">Articles</div>
                <div className="col-span-2">Statut</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {/* Lignes */}
              <div className="divide-y divide-gray-50">
                {orders.map((order) => {
                  const status = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700 border-gray-200' };
                  const totalFCFA = Math.round(order.totalAmount / 100);
                  return (
                    <Link
                      key={order.id}
                      href={`/compte/commandes/${order.id}`}
                      className="flex sm:grid sm:grid-cols-12 sm:gap-4 items-center px-6 py-4 hover:bg-orange-50/30 transition-colors group cursor-pointer"
                    >
                      {/* Numéro */}
                      <div className="sm:col-span-3 flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ShoppingBagIcon className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="font-semibold text-gray-900 text-sm truncate">
                          #{order.id.substring(0, 8).toUpperCase()}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="sm:col-span-3 text-sm text-gray-500 hidden sm:block">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </div>

                      {/* Articles */}
                      <div className="sm:col-span-2 text-sm text-gray-500 hidden sm:block">
                        {order.items.length} art.
                      </div>

                      {/* Statut */}
                      <div className="sm:col-span-2 ml-2 sm:ml-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Total + flèche */}
                      <div className="sm:col-span-2 flex items-center justify-end gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          {totalFCFA.toLocaleString()} <span className="text-gray-500 font-normal text-xs">F</span>
                        </span>
                        <ArrowRightIcon className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} sur {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                    Précédent
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Suivant
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}
