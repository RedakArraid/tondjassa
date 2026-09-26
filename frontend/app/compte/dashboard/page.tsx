'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { AccountService } from '../../config/api';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import {
  ShoppingBagIcon,
  CurrencyDollarIcon,
  StarIcon,
  ArrowRightIcon,
  ArrowLeftStartOnRectangleIcon,
  UserCircleIcon,
  MapPinIcon,
  KeyIcon,
  ShieldCheckIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

import { Suspense } from 'react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmée', color: 'bg-blue-100 text-blue-800' },
  PROCESSING: { label: 'En traitement', color: 'bg-violet-100 text-violet-800' },
  SHIPPED: { label: 'Expédiée', color: 'bg-orange-100 text-orange-800' },
  DELIVERED: { label: 'Livrée', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Annulée', color: 'bg-red-100 text-red-800' },
  REFUNDED: { label: 'Remboursée', color: 'bg-gray-100 text-gray-800' },
};

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: { id: string; product?: { name: string; image?: string; price: number } }[];
}

interface ReturnReq {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  order: {
    id: string;
    totalAmount: number;
    items: { product: { name: string } }[];
  };
}

interface AddressData {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') || 'apercu';

  const { customer, isAuthenticated, isLoading, logout, refreshCustomer } = useCustomerAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Orders & returns
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [returns, setReturns] = useState<ReturnReq[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Address form
  const [addressForm, setAddressForm] = useState<AddressData>({
    street: '',
    city: '',
    postalCode: '',
    country: 'Mali',
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressSuccess, setAddressSuccess] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [hasAddress, setHasAddress] = useState(false);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Account deletion
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/compte/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Sync profile form when customer changes
  useEffect(() => {
    if (customer) {
      setProfileForm({
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phone: customer.phone || '',
      });
    }
  }, [customer]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    try {
      const [ordersRes, returnsRes, addressRes] = await Promise.allSettled([
        AccountService.getOrders(1, 10),
        AccountService.getReturns(),
        AccountService.getAddress(),
      ]);

      if (ordersRes.status === 'fulfilled' && ordersRes.value.orders) {
        setOrders(ordersRes.value.orders);
        setOrderTotal(ordersRes.value.pagination?.total ?? ordersRes.value.orders.length);
      }
      if (returnsRes.status === 'fulfilled' && returnsRes.value.returns) {
        setReturns(returnsRes.value.returns);
      }
      if (addressRes.status === 'fulfilled' && addressRes.value.address) {
        const addr = addressRes.value.address;
        setAddressForm({
          street: addr.street || '',
          city: addr.city || '',
          postalCode: addr.postalCode || '',
          country: addr.country || 'Mali',
        });
        setHasAddress(true);
      } else {
        setHasAddress(false);
      }
    } catch {
      // ignore
    } finally {
      setDataLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess(false);
    try {
      await AccountService.updateProfile(profileForm);
      await refreshCustomer();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressSaving(true);
    setAddressError('');
    setAddressSuccess(false);
    try {
      await AccountService.saveAddress(addressForm);
      setHasAddress(true);
      setAddressSuccess(true);
      setTimeout(() => setAddressSuccess(false), 3000);
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async () => {
    if (!confirm('Supprimer cette adresse de livraison ?')) return;
    try {
      await AccountService.deleteAddress();
      setAddressForm({ street: '', city: '', postalCode: '', country: 'Mali' });
      setHasAddress(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur suppression adresse');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    if (passwordForm.newPassword.length < 12) {
      setPasswordError('Le nouveau mot de passe doit comporter au moins 12 caractères');
      return;
    }
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess(false);
    try {
      await AccountService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      sessionStorage.removeItem('mandemarket_customer_token');
      window.location.replace('/compte/login?passwordChanged=1');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erreur changement de mot de passe');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await AccountService.deleteAccount(deletePassword);
      logout();
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setDeleteLoading(false);
    }
  };

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

  if (!customer) return null;

  const totalSpentFCFA = Math.round(customer.totalSpent / 100);
  const initials = `${customer.firstName?.[0] || 'U'}${customer.lastName?.[0] || 'C'}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
      <PublicHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header bienvenue */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 rounded-2xl p-6 sm:p-8 mb-8 shadow-lg text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                {initials}
              </div>
              <div>
                <p className="text-orange-100 text-sm font-medium">Espace client MandeMarket</p>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {customer.firstName} {customer.lastName}
                </h1>
                <p className="text-orange-200 text-sm">{customer.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl font-medium transition-all text-sm backdrop-blur-sm"
            >
              <ArrowLeftStartOnRectangleIcon className="w-4 h-4" />
              Se déconnecter
            </button>
          </div>
        </div>

        {/* Navigation Onglets */}
        <div className="flex items-center gap-2 border-b border-gray-200 mb-8 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'apercu', label: 'Vue d’ensemble', icon: ShoppingBagIcon },
            { id: 'commandes', label: 'Commandes & Retours', icon: ShoppingBagIcon },
            { id: 'profil', label: 'Profil & Coordonnées', icon: UserCircleIcon },
            { id: 'adresse', label: 'Adresse de livraison', icon: MapPinIcon },
            { id: 'securite', label: 'Sécurité & Compte', icon: ShieldCheckIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                  active
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CONTENU ONGLETS */}

        {/* 1. VUE D'ENSEMBLE */}
        {activeTab === 'apercu' && (
          <div className="space-y-8">
            {/* Statistiques */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingBagIcon className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Commandes passées</p>
                  <p className="text-2xl font-bold text-gray-900">{orderTotal}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total des achats</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalSpentFCFA.toLocaleString()}{' '}
                    <span className="text-sm font-semibold text-gray-500">FCFA</span>
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <StarIcon className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Points fidélité</p>
                  <p className="text-2xl font-bold text-gray-900">{customer.loyaltyPoints} pts</p>
                </div>
              </div>
            </div>

            {/* Commandes récentes */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Commandes récentes</h2>
                  <p className="text-xs text-gray-500">Vos 3 dernières commandes sur le marché</p>
                </div>
                <button
                  onClick={() => setActiveTab('commandes')}
                  className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-semibold transition-colors"
                >
                  Voir tout
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>

              {dataLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingBagIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Vous n'avez pas encore passé de commande.</p>
                  <Link
                    href="/boutique"
                    className="mt-4 inline-block px-5 py-2.5 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors text-sm"
                  >
                    Découvrir les produits
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 3).map((order) => {
                    const status = STATUS_LABELS[order.status] || {
                      label: order.status,
                      color: 'bg-gray-100 text-gray-700',
                    };
                    const totalFCFA = Math.round(order.totalAmount / 100);
                    return (
                      <Link
                        key={order.id}
                        href={`/compte/commandes/${order.id}`}
                        className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/20 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                            <ShoppingBagIcon className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              #{order.id.substring(0, 8).toUpperCase()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                              {' · '}
                              {order.items?.length || 0} article{order.items?.length > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                          <span className="font-bold text-gray-900 text-sm hidden sm:block">
                            {totalFCFA.toLocaleString()} FCFA
                          </span>
                          <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Retours récents si présents */}
            {returns.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowUturnLeftIcon className="w-5 h-5 text-orange-600" />
                  <h2 className="text-lg font-bold text-gray-900">Demandes de retours en cours</h2>
                </div>
                <div className="space-y-3">
                  {returns.slice(0, 2).map((ret) => (
                    <div
                      key={ret.id}
                      className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          Retour pour commande #{ret.order?.id?.substring(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">Motif : {ret.reason}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          ret.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : ret.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {ret.status === 'completed'
                          ? 'Remboursé'
                          : ret.status === 'rejected'
                          ? 'Refusé'
                          : ret.status === 'approved'
                          ? 'Retour approuvé — remboursement en attente'
                          : 'En attente d’approbation'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. MES COMMANDES & RETOURS */}
        {activeTab === 'commandes' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Toutes mes commandes</h2>

              {dataLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBagIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Aucune commande enregistrée</p>
                  <Link
                    href="/boutique"
                    className="mt-4 inline-block px-5 py-2.5 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors text-sm"
                  >
                    Parcourir le catalogue
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const status = STATUS_LABELS[order.status] || {
                      label: order.status,
                      color: 'bg-gray-100 text-gray-700',
                    };
                    const totalFCFA = Math.round(order.totalAmount / 100);
                    return (
                      <div
                        key={order.id}
                        className="p-5 rounded-xl border border-gray-200 hover:border-orange-300 transition-all bg-white"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-3">
                          <div>
                            <span className="font-bold text-gray-900 text-base">
                              Commande #{order.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500 ml-3">
                              {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                              {status.label}
                            </span>
                            <span className="font-bold text-gray-900">
                              {totalFCFA.toLocaleString()} FCFA
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            {order.items?.length || 0} article{order.items?.length > 1 ? 's' : ''} commandé{order.items?.length > 1 ? 's' : ''}
                          </p>
                          <Link
                            href={`/compte/commandes/${order.id}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
                          >
                            Détails & Suivi
                            <ArrowRightIcon className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section Retours */}
            {returns.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowUturnLeftIcon className="w-5 h-5 text-orange-600" />
                  Historique des demandes de retours
                </h2>
                <div className="space-y-3">
                  {returns.map((ret) => (
                    <div
                      key={ret.id}
                      className="p-4 rounded-xl border border-gray-200 bg-gray-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          Demande #{ret.id.substring(0, 8).toUpperCase()} — Commande #{ret.order?.id?.substring(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Raison :</span> {ret.reason}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Soumis le {new Date(ret.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-center ${
                          ret.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : ret.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : ret.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {ret.status === 'completed'
                          ? 'Remboursement effectué'
                          : ret.status === 'rejected'
                          ? 'Demande rejetée'
                          : ret.status === 'approved'
                          ? 'Retour validé en attente'
                          : 'En cours de revue'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. PROFIL & COORDONNÉES */}
        {activeTab === 'profil' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 max-w-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Informations personnelles</h2>
            <p className="text-sm text-gray-500 mb-6">
              Mettez à jour vos coordonnées utilisées pour la livraison et la facturation.
            </p>

            {profileSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                Vos coordonnées ont été enregistrées avec succès.
              </div>
            )}

            {profileError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
                {profileError}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nom *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Adresse email</label>
                <input
                  type="email"
                  disabled
                  value={customer.email}
                  className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">L'adresse email est liée à votre compte sécurisé.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Numéro de téléphone</label>
                <input
                  type="tel"
                  placeholder="+223 XX XX XX XX"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-60 shadow-sm"
                >
                  {profileSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4. ADRESSE DE LIVRAISON */}
        {activeTab === 'adresse' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900">Adresse de livraison par défaut</h2>
              {hasAddress && (
                <button
                  onClick={handleDeleteAddress}
                  className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                >
                  <TrashIcon className="w-4 h-4" />
                  Supprimer
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Cette adresse sera automatiquement présélectionnée lors du règlement de vos commandes.
            </p>

            {addressSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                Adresse de livraison enregistrée avec succès.
              </div>
            )}

            {addressError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
                {addressError}
              </div>
            )}

            <form onSubmit={handleAddressSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rue / Quartier *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rue 214, Porte 34, Badalabougou"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ville *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Bamako"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Code postal</label>
                  <input
                    type="text"
                    placeholder="Optionnel"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Pays *</label>
                <select
                  value={addressForm.country}
                  onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                >
                  <option value="Mali">Mali</option>
                  <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                  <option value="Sénégal">Sénégal</option>
                  <option value="Burkina Faso">Burkina Faso</option>
                  <option value="Guinée">Guinée</option>
                  <option value="France">France</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={addressSaving}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-60 shadow-sm"
                >
                  {addressSaving ? 'Enregistrement...' : hasAddress ? 'Mettre à jour l’adresse' : 'Ajouter cette adresse'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 5. SÉCURITÉ & COMPTE */}
        {activeTab === 'securite' && (
          <div className="space-y-8 max-w-2xl">
            {/* Changement de mot de passe */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-2">
                <KeyIcon className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-bold text-gray-900">Changer de mot de passe</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Pour sécuriser votre compte, utilisez au moins 12 caractères.
              </p>

              {passwordSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  Votre mot de passe a été modifié avec succès.
                </div>
              )}

              {passwordError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                  <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
                  {passwordError}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Mot de passe actuel *
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Nouveau mot de passe *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Confirmer le nouveau mot de passe *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-60 shadow-sm"
                  >
                    {passwordSaving ? 'Modification...' : 'Modifier le mot de passe'}
                  </button>
                </div>
              </form>
            </div>

            {/* Zone de danger : Suppression de compte */}
            <div className="bg-red-50/50 rounded-2xl border border-red-200 p-6 sm:p-8">
              <h3 className="text-base font-bold text-red-900 mb-1">Zone de danger</h3>
              <p className="text-xs text-red-700 mb-4">
                La suppression de votre compte anonymise l'ensemble de vos données personnelles et révoque vos sessions conformément au RGPD.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeletePassword('');
                  setDeleteError('');
                  setDeleteModal(true);
                }}
                className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-100 rounded-xl text-xs font-semibold transition-colors"
              >
                Supprimer mon compte définitivement
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmation suppression de compte */}
      {deleteModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
          onClick={() => setDeleteModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Confirmer la suppression du compte
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Veuillez saisir votre mot de passe pour confirmer l’anonymisation et la clôture définitive de votre compte.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mot de passe actuel *
                </label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 text-xs font-medium hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteLoading ? 'Suppression...' : 'Supprimer mon compte'}
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

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
