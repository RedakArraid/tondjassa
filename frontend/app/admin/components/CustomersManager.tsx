'use client';

import { apiFetch as fetch } from '../../lib/api-fetch';
import { useState, useEffect } from 'react';
import { 
  UserIcon, 
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ShoppingBagIcon,
  StarIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  totalSpent: number;
  loyaltyPoints: number;
  createdAt: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  orders: Array<{
    id: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }>;
}

interface CustomerAnalytics {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  favoriteCategories: Array<{
    category: string;
    quantity: number;
  }>;
  period: string;
}

export default function CustomersManager({ token }: { token: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'Côte d\'Ivoire'
  });

  useEffect(() => {
    loadCustomers();
  }, [filterStatus, page, limit]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      loadCustomers();
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerAnalytics(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await fetch(`${API_URL}/api/customers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setCustomers(data.customers || []);
      if (data.pagination) {
        setTotalPages(data.pagination.pages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerAnalytics = async (customerId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/customers/${customerId}/analytics?period=90`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setCustomerAnalytics(data);
    } catch (error) {
      console.error('Erreur chargement analytics:', error);
    }
  };

  const createCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          address: formData.street ? {
            street: formData.street,
            city: formData.city,
            postalCode: formData.postalCode,
            country: formData.country,
            isDefault: true
          } : undefined
        })
      });

      if (response.ok) {
        loadCustomers();
        setShowNewCustomerForm(false);
        setFormData({
          email: '',
          firstName: '',
          lastName: '',
          phone: '',
          street: '',
          city: '',
          postalCode: '',
          country: 'Côte d\'Ivoire'
        });
        alert('Client créé avec succès');
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur création client:', error);
      alert('Erreur lors de la création du client');
    }
  };

  const updateCustomerStatus = async (customerId: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/api/customers/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        loadCustomers();
        alert('Statut mis à jour');
      }
    } catch (error) {
      console.error('Erreur mise à jour:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format((price || 0) / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Recherche côté serveur => plus de filtrage local
  const filteredCustomers = customers;

  if (loading) {
    return <div className="text-center py-12">Chargement des clients...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Clients</p>
              <p className="text-3xl font-bold text-gray-900">{totalCount}</p>
            </div>
            <UserIcon className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clients Actifs</p>
              <p className="text-3xl font-bold text-gray-900">
                {customers.filter(c => c.status === 'active').length}
              </p>
            </div>
            <CheckCircleIcon className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revenu Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(customers.reduce((sum, c) => sum + c.totalSpent, 0))}
              </p>
            </div>
            <ChartBarIcon className="w-12 h-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Points Fidélité</p>
              <p className="text-3xl font-bold text-gray-900">
                {customers.reduce((sum, c) => sum + c.loyaltyPoints, 0)}
              </p>
            </div>
            <StarIcon className="w-12 h-12 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>

          <button
            onClick={() => setShowNewCustomerForm(true)}
            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            <UserIcon className="w-5 h-5" />
            Nouveau client
          </button>
        </div>
      </div>

      {/* Liste des clients */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commandes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total dépensé</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          Depuis {formatDate(customer.createdAt)}
                        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t bg-white">
          <div className="text-sm text-gray-600">
            Page {page} / {totalPages} • {totalCount} client(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Précédent
            </button>
            <select
              value={limit}
              onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }}
              className="px-2 py-1 border rounded"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <EnvelopeIcon className="w-4 h-4 mr-2" />
                        {customer.email}
                      </div>
                      {customer.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <PhoneIcon className="w-4 h-4 mr-2" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <ShoppingBagIcon className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm font-semibold">{customer.orders.length}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">
                      {formatPrice(customer.totalSpent)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <StarIcon className="w-5 h-5 text-yellow-500 mr-1" />
                      <span className="text-sm font-semibold">{customer.loyaltyPoints}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => updateCustomerStatus(customer.id, customer.status === 'active' ? 'inactive' : 'active')}
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        customer.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {customer.status === 'active' ? '✓ Actif' : '○ Inactif'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedCustomer(customer)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucun client trouvé
          </div>
        )}
      </div>

      {/* Modal nouveau client */}
      {showNewCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Nouveau Client</h3>
                <button
                  onClick={() => setShowNewCustomerForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={createCustomer} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+225 XX XX XX XX XX"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-4">Adresse (optionnel)</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rue</label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 font-medium"
                >
                  Créer le client
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerForm(false)}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal détails client */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h3>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerAnalytics(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Informations de base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Informations</h4>
                  <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center text-sm">
                      <EnvelopeIcon className="w-5 h-5 text-gray-400 mr-2" />
                      <span>{selectedCustomer.email}</span>
                    </div>
                    {selectedCustomer.phone && (
                      <div className="flex items-center text-sm">
                        <PhoneIcon className="w-5 h-5 text-gray-400 mr-2" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div className="flex items-start text-sm">
                        <MapPinIcon className="w-5 h-5 text-gray-400 mr-2 mt-0.5" />
                        <div>
                          <p>{selectedCustomer.address.street}</p>
                          <p>{selectedCustomer.address.city}, {selectedCustomer.address.postalCode}</p>
                          <p>{selectedCustomer.address.country}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Statistiques</h4>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total dépensé</span>
                      <span className="text-sm font-bold">{formatPrice(selectedCustomer.totalSpent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Points fidélité</span>
                      <span className="text-sm font-bold">{selectedCustomer.loyaltyPoints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Commandes</span>
                      <span className="text-sm font-bold">{selectedCustomer.orders.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Client depuis</span>
                      <span className="text-sm font-bold">{formatDate(selectedCustomer.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analytics (90 derniers jours) */}
              {customerAnalytics && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Analyse des achats ({customerAnalytics.period})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Commandes</p>
                      <p className="text-2xl font-bold text-blue-700">{customerAnalytics.totalOrders}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Dépensé</p>
                      <p className="text-2xl font-bold text-green-700">
                        {formatPrice(customerAnalytics.totalSpent)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Panier moyen</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {formatPrice(customerAnalytics.averageOrderValue)}
                      </p>
                    </div>
                  </div>

                  {customerAnalytics.favoriteCategories.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Catégories préférées</p>
                      <div className="flex flex-wrap gap-2">
                        {customerAnalytics.favoriteCategories.map((cat, idx) => (
                          <span key={idx} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                            {cat.category} ({cat.quantity})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Historique des commandes */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Historique des commandes</h4>
                <div className="space-y-3">
                  {selectedCustomer.orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">#{order.id.substring(0, 8)}</p>
                        <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatPrice(order.totalAmount)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                          order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {selectedCustomer.orders.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Aucune commande</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

