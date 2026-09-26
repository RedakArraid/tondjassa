'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BanknotesIcon,
  CurrencyEuroIcon,
  ShoppingBagIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChartBarIcon,
  CreditCardIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  EyeIcon,
  BuildingStorefrontIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AuthService, SellerService, ProductService, CategoryService } from '../../../config/api';
import CloudinaryImageUpload from '../../../components/CloudinaryImageUpload';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'mtn_money', label: 'MTN Money' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PROCESSING: 'En traitement',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

const PAYOUT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  completed: 'Complété',
  rejected: 'Rejeté',
};

const CONDITION_OPTIONS = [
  { value: 'new', label: 'Neuf' },
  { value: 'used_good', label: 'Occasion - Bon état' },
  { value: 'used_fair', label: 'Occasion - État correct' },
  { value: 'refurbished', label: 'Reconditionné' },
];

const PIE_COLORS = ['#1A8F5C', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#6b7280'];

export type Section = 'overview' | 'products' | 'orders' | 'stats' | 'payments' | 'profile';

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: ChartBarIcon },
  { id: 'products', label: 'Produits', icon: CubeIcon },
  { id: 'orders', label: 'Commandes', icon: ShoppingBagIcon },
  { id: 'stats', label: 'Statistiques', icon: ChartBarIcon },
  { id: 'payments', label: 'Paiements', icon: BanknotesIcon },
  { id: 'profile', label: 'Profil boutique', icon: BuildingStorefrontIcon },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR') + ' FCFA';
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function statusBadge(status: string, colors: Record<string, string>, labels: Record<string, string>) {
  const key = status?.toUpperCase() in colors ? status.toUpperCase() : status;
  const cls = colors[key] || colors[status] || 'bg-gray-100 text-gray-600';
  const label = labels[key] || labels[status] || status;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

export function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center text-gray-400 text-sm">{message}</div>
  );
}

// ─── Loading Spinner ─────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
  return (
    <div className={`animate-spin rounded-full border-b-2 border-orange-500 ${sz}`} />
  );
}

// ─── Section: Overview ───────────────────────────────────────────────────────

export function OverviewSection({
  earnings,
  products,
  orders,
}: {
  earnings: any;
  products: any[];
  orders: any[];
}) {
  const activeProducts = products.filter((p) => p.status === 'active').length;
  const lowStock = products.filter((p) => p.stock <= 5).length;
  const recentOrders = orders.slice(0, 5);
  const recentProducts = products.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div id="solde" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          icon={BanknotesIcon}
          label="Chiffre d'affaires"
          value={fmt(earnings?.totalSales ?? 0)}
          color="bg-green-500"
        />
        <KpiCard
          icon={CurrencyEuroIcon}
          label="Revenus nets"
          value={fmt(earnings?.totalEarnings ?? 0)}
          subtitle={`Commission ${earnings?.commissionRate ?? 0}%`}
          color="bg-orange-500"
        />
        <KpiCard
          icon={ShoppingBagIcon}
          label="Commandes"
          value={earnings?.totalOrders ?? 0}
          color="bg-blue-500"
        />
        <KpiCard
          icon={CubeIcon}
          label="Produits actifs"
          value={activeProducts}
          color="bg-purple-500"
        />
        <KpiCard
          icon={ExclamationTriangleIcon}
          label="Stock faible"
          value={lowStock}
          subtitle={lowStock > 0 ? 'Produits avec stock ≤ 5' : 'Aucun produit en rupture'}
          color={lowStock > 0 ? 'bg-red-500' : 'bg-green-500'}
        />
        <KpiCard
          icon={ClockIcon}
          label="Versement en attente"
          value={fmt(earnings?.pendingPayoutAmount ?? 0)}
          color="bg-yellow-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div id="commandes-recentes" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Commandes récentes</h3>
          {recentOrders.length === 0 ? (
            <EmptyState message="Aucune commande pour le moment." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b">
                    <th className="pb-2 text-left font-medium">N° commande</th>
                    <th className="pb-2 text-left font-medium">Client</th>
                    <th className="pb-2 text-left font-medium">Montant</th>
                    <th className="pb-2 text-left font-medium">Statut</th>
                    <th className="pb-2 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentOrders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="py-2 font-mono text-xs text-gray-500">#{String(o.id).slice(0, 8)}</td>
                      <td className="py-2">{o.customer?.firstName} {o.customer?.lastName}</td>
                      <td className="py-2 font-medium">{fmt(o.totalAmount ?? 0)}</td>
                      <td className="py-2">{statusBadge(o.status, STATUS_COLORS, STATUS_LABELS)}</td>
                      <td className="py-2 text-gray-400">{fmtDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Products */}
        <div id="produits-populaires" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Produits populaires</h3>
          {recentProducts.length === 0 ? (
            <EmptyState message="Aucun produit. Ajoutez votre premier produit." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b">
                    <th className="pb-2 text-left font-medium">Produit</th>
                    <th className="pb-2 text-left font-medium">Prix</th>
                    <th className="pb-2 text-left font-medium">Stock</th>
                    <th className="pb-2 text-left font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentProducts.map((p: any) => (
                    <tr key={p.id} className={`hover:bg-gray-50 ${p.stock <= 5 ? 'bg-yellow-50' : ''}`}>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {p.image && (
                            <img src={p.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                          )}
                          <span className="truncate max-w-[140px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2 font-medium">{fmt(p.price ?? 0)}</td>
                      <td className="py-2">
                        <span className={p.stock <= 5 ? 'text-red-600 font-semibold' : ''}>{p.stock}</span>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {p.status === 'active' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div id="abonnes" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Nouveaux abonnés</h3>
          <p className="text-sm text-gray-500">Suivez les clients qui s&apos;abonnent à votre boutique.</p>
          <p className="mt-4 text-3xl font-bold text-brand-navy">0</p>
          <p className="text-xs text-gray-400 mt-1">cette semaine</p>
        </div>
        <div id="alertes" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Alertes</h3>
          {lowStock > 0 ? (
            <p className="text-sm text-red-600 font-medium">{lowStock} produit(s) en stock faible.</p>
          ) : (
            <p className="text-sm text-gray-500">Aucune alerte pour le moment.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Actions rapides</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/vendeur/dashboard/produits/ajouter"
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Ajouter un produit
          </Link>
          <Link
            href="/vendeur/dashboard/commandes"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            <ShoppingBagIcon className="w-4 h-4" />
            Voir les commandes
          </Link>
          <Link
            href="/vendeur/dashboard/paiements/retraits"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            <BanknotesIcon className="w-4 h-4" />
            Demander un versement
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Product Form ─────────────────────────────────────────────────────────────

const EMPTY_PRODUCT_FORM = {
  name: '',
  price: '' as string | number,
  categoryId: '',
  image: '',
  description: '',
  stock: 0,
  sku: '',
  status: 'active',
  colors: '',
  features: '',
  brand: '',
  condition: 'new',
};

function ProductForm({
  initial,
  categories,
  onSave,
  onCancel,
}: {
  initial?: any;
  categories: any[];
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ...EMPTY_PRODUCT_FORM,
    ...(initial
      ? {
          name: initial.name || '',
          price: initial.price ? initial.price / 100 : '',
          categoryId: initial.categoryId || '',
          image: initial.image || '',
          description: initial.description || '',
          stock: initial.stock ?? 0,
          sku: initial.sku || '',
          status: initial.status || 'active',
          colors: Array.isArray(initial.colors) ? initial.colors.join(', ') : (initial.colors || ''),
          features: Array.isArray(initial.features) ? initial.features.join(', ') : (initial.features || ''),
          brand: initial.brand || '',
          condition: initial.condition || 'new',
        }
      : {}),
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        price: Math.round(parseFloat(String(form.price)) * 100),
        categoryId: form.categoryId,
        image: form.image,
        description: form.description,
        stock: parseInt(String(form.stock)) || 0,
        sku: form.sku,
        status: form.status,
        colors: form.colors ? form.colors.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        features: form.features ? form.features.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        brand: form.brand,
        condition: form.condition,
        styles: [],
      };
      await onSave(payload);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        {initial ? 'Modifier le produit' : 'Nouveau produit'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="Nom du produit"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix en FCFA *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="Ex: 25000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
            <select
              required
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="">Choisir une catégorie...</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marque</label>
            <input
              value={form.brand}
              onChange={(e) => set('brand', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="Marque du produit"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
          <CloudinaryImageUpload
            currentImage={form.image}
            onImageChange={(url) => set('image', url)}
            placeholder="Choisir une image pour le produit"
            maxSize={5 * 1024 * 1024}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
            placeholder="Description du produit..."
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => set('stock', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <input
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="SKU-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">État</label>
            <select
              value={form.condition}
              onChange={(e) => set('condition', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              {CONDITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Couleurs (séparées par virgule)</label>
            <input
              value={form.colors}
              onChange={(e) => set('colors', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="Rouge, Bleu, Vert"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caractéristiques (séparées par virgule)</label>
            <input
              value={form.features}
              onChange={(e) => set('features', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="Imperméable, Résistant, Léger"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Section: Products ───────────────────────────────────────────────────────

export function ProductsSection({
  products,
  categories,
  total,
  pages,
  currentPage,
  onPageChange,
  onRefresh,
  openFormOnMount = false,
}: {
  products: any[];
  categories: any[];
  total: number;
  pages: number;
  currentPage: number;
  onPageChange: (p: number) => void;
  onRefresh: () => Promise<void> | void;
  openFormOnMount?: boolean;
}) {
  const [showForm, setShowForm] = useState(openFormOnMount);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSave = async (payload: any) => {
    try {
      setError('');
      if (editing) {
        await ProductService.update(String(editing.id), payload);
      } else {
        await ProductService.create(payload);
      }
      setShowForm(false);
      setEditing(null);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
      throw err;
    }
  };

  const handleEdit = (p: any) => {
    setEditing(p);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit définitivement ?')) return;
    try {
      setError('');
      await ProductService.delete(String(id));
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mes produits</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} produit{total !== 1 ? 's' : ''} au total</p>
        </div>
        {!showForm && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Ajouter un produit
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {showForm && (
        <ProductForm
          initial={editing}
          categories={categories}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {products.length === 0 ? (
          <EmptyState message="Aucun produit. Cliquez sur « Ajouter un produit » pour commencer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p: any) => (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${p.stock <= 5 ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image || 'https://via.placeholder.com/48'}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                        <div>
                          <p className="font-medium text-sm text-gray-900">{p.name}</p>
                          {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{fmt(p.price ?? 0)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-medium ${p.stock <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                        {p.stock}
                        {p.stock <= 5 && <ExclamationTriangleIcon className="w-4 h-4 inline ml-1 text-red-500" />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'active' ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {currentPage} sur {pages}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              aria-label="Page précédente des produits"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pages}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              aria-label="Page suivante des produits"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Orders ─────────────────────────────────────────────────────────

const ORDER_FILTER_TABS = [
  { label: 'Toutes', value: '' },
  { label: 'En attente', value: 'PENDING' },
  { label: 'Confirmées', value: 'CONFIRMED' },
  { label: 'Expédiées', value: 'SHIPPED' },
  { label: 'Livrées', value: 'DELIVERED' },
  { label: 'Annulées', value: 'CANCELLED' },
];

export function OrdersSection({
  orders,
  total,
  pages,
  currentPage,
  currentStatus,
  onPageChange,
  onStatusChange,
}: {
  orders: any[];
  total: number;
  pages: number;
  currentPage: number;
  currentStatus: string;
  onPageChange: (p: number) => void;
  onStatusChange: (s: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = orders.filter((o: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(o.id).toLowerCase().includes(q) ||
      `${o.customer?.firstName} ${o.customer?.lastName}`.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Commandes</h2>
        <p className="text-sm text-gray-500 mt-0.5">{total} commande{total !== 1 ? 's' : ''} au total</p>
      </div>

      {/* Filters + Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-wrap gap-1">
            {ORDER_FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onStatusChange(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  currentStatus === tab.value
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState message="Aucune commande trouvée." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° commande</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produits</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livraison</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o: any) => (
                  <>
                    <tr
                      key={o.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggle(o.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{String(o.id).slice(0, 8)}</td>
                      <td className="px-4 py-3 text-sm">{o.customer?.firstName} {o.customer?.lastName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {Array.isArray(o.items) ? `${o.items.length} article${o.items.length > 1 ? 's' : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{fmt(o.totalAmount ?? 0)}</td>
                      <td className="px-4 py-3 text-sm">
                        {o.payment ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.payment.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {o.payment.status === 'paid' ? 'Payé' : o.payment.status}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {o.shipping?.status ? (
                          <span className="text-xs text-gray-600">{o.shipping.status}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{fmtDate(o.createdAt)}</td>
                      <td className="px-4 py-3">{statusBadge(o.status, STATUS_COLORS, STATUS_LABELS)}</td>
                      <td className="px-4 py-3 text-right">
                        {expandedId === o.id
                          ? <ChevronUpIcon className="w-4 h-4 text-gray-400 ml-auto" />
                          : <ChevronDownIcon className="w-4 h-4 text-gray-400 ml-auto" />}
                      </td>
                    </tr>
                    {expandedId === o.id && (
                      <tr key={`${o.id}-detail`}>
                        <td colSpan={9} className="px-6 py-5 bg-orange-50 border-t border-orange-100">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            {/* Items */}
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">Articles</h4>
                              {Array.isArray(o.items) && o.items.length > 0 ? (
                                <ul className="space-y-1">
                                  {o.items.map((item: any, idx: number) => (
                                    <li key={idx} className="flex justify-between">
                                      <span>{item.product?.name || 'Produit'} × {item.quantity}</span>
                                      <span className="font-medium">{fmt(item.unitPrice ?? 0)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : <p className="text-gray-400">—</p>}
                            </div>
                            {/* Customer */}
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">Client</h4>
                              <p>{o.customer?.firstName} {o.customer?.lastName}</p>
                              {o.customer?.email && <p className="text-gray-400">{o.customer.email}</p>}
                              {o.shippingAddress && (
                                <p className="text-gray-400 mt-1">
                                  {[o.shippingAddress.address, o.shippingAddress.city, o.shippingAddress.country].filter(Boolean).join(', ')}
                                </p>
                              )}
                            </div>
                            {/* Payment & Shipping */}
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">Paiement & Livraison</h4>
                              {o.payment && (
                                <p>Mode : <span className="font-medium">{o.payment.method || '—'}</span></p>
                              )}
                              {o.shipping?.trackingCode && (
                                <p className="mt-1">Suivi : <span className="font-mono text-orange-700">{o.shipping.trackingCode}</span></p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {currentPage} sur {pages}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              aria-label="Page précédente des commandes"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pages}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              aria-label="Page suivante des commandes"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Stats ──────────────────────────────────────────────────────────

export function StatsSection({ orders, products }: { orders: any[]; products: any[] }) {
  // Build daily revenue from orders (last 30 days)
  const dailyRevenue = (() => {
    const now = new Date();
    const map: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    orders.forEach((o: any) => {
      const day = String(o.createdAt || '').slice(0, 10);
      if (day in map) {
        map[day] = (map[day] || 0) + (o.totalAmount || 0);
      }
    });
    return Object.entries(map).map(([date, revenue]) => ({
      date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      revenue: revenue / 100,
    }));
  })();

  // Top products by revenue from order items
  const productRevenue: Record<string, { name: string; revenue: number; units: number }> = {};
  orders.forEach((o: any) => {
    if (!Array.isArray(o.items)) return;
    o.items.forEach((item: any) => {
      const name = item.product?.name || 'Inconnu';
      const id = item.product?.id || name;
      if (!productRevenue[id]) productRevenue[id] = { name, revenue: 0, units: 0 };
      productRevenue[id].revenue += (item.unitPrice || 0) * (item.quantity || 1);
      productRevenue[id].units += item.quantity || 1;
    });
  });
  const topProducts = Object.values(productRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((p) => ({ ...p, revenue: p.revenue / 100 }));

  // Orders by status
  const statusCounts: Record<string, number> = {};
  orders.forEach((o: any) => {
    const key = o.status?.toUpperCase() || 'UNKNOWN';
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  });
  const pieData = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
  }));

  if (orders.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-6">Statistiques</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <ChartBarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune donnée disponible.</p>
          <p className="text-sm text-gray-400 mt-1">Les statistiques apparaîtront dès que vous aurez des commandes.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Statistiques</h2>
        <p className="text-sm text-gray-400">Données basées sur vos {orders.length} dernières commandes</p>
      </div>

      <div className="space-y-6">
        {/* Revenue Area Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Chiffre d'affaires — 30 derniers jours</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyRevenue} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A8F5C" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1A8F5C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${v.toLocaleString()}`} />
              <Tooltip
                formatter={(value: number) => [`${value.toLocaleString('fr-FR')} FCFA`, 'Revenus']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#1A8F5C"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          {topProducts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Top produits par revenus</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#374151' }} width={100} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR')} FCFA`, 'Revenus']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="revenue" fill="#1A8F5C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Orders by Status Pie */}
          {pieData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Commandes par statut</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, 'Commandes']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Payments ───────────────────────────────────────────────────────

export function PaymentsSection({
  earnings,
  payouts,
  profile,
  onProfileUpdate,
  onPayoutsRefresh,
}: {
  earnings: any;
  payouts: any[];
  profile: any;
  onProfileUpdate: (p: any) => void;
  onPayoutsRefresh: () => Promise<void>;
}) {
  const [balanceData, setBalanceData] = useState<{
    pending: number;
    available: number;
    reserved: number;
    paid: number;
    currency: string;
  } | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    method: profile?.paymentInfo?.method || 'mobile_money',
    accountNumber: profile?.paymentInfo?.accountNumber || '',
    accountName: profile?.paymentInfo?.accountName || '',
    operator: profile?.paymentInfo?.operator || '',
  });
  const [payoutAmount, setPayoutAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFinancials = useCallback(async () => {
    try {
      setLoadingBalance(true);
      const [bRes, lRes] = await Promise.allSettled([
        SellerService.getMyBalance(),
        SellerService.getMyLedger(1, 30),
      ]);
      if (bRes.status === 'fulfilled' && bRes.value?.balances) {
        setBalanceData(bRes.value.balances);
      }
      if (lRes.status === 'fulfilled' && lRes.value?.entries) {
        setLedgerEntries(lRes.value.entries);
      }
    } catch (e) {
      console.error('Erreur chargement données financières:', e);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    loadFinancials();
  }, [loadFinancials]);

  const availableCents = balanceData?.available ?? Math.max(0, (earnings?.availableBalance ?? earnings?.totalEarnings ?? 0));
  const pendingCents = balanceData?.pending ?? (earnings?.pendingPayoutAmount ?? 0);
  const reservedCents = balanceData?.reserved ?? 0;
  const paidCents = balanceData?.paid ?? payouts.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPayment(true);
    setError('');
    setSuccess('');
    try {
      await SellerService.updateMyProfile({ paymentInfo: paymentForm });
      onProfileUpdate({ paymentInfo: paymentForm });
      setSuccess('Informations de paiement enregistrées avec succès.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await SellerService.downloadLedgerCsv();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’export CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const rawVal = parseFloat(payoutAmount);
    const amountInCents = Math.round(rawVal * 100);

    if (!amountInCents || amountInCents < 500000) {
      setError('Le montant minimum de retrait est de 5 000 FCFA.');
      return;
    }
    if (!profile?.paymentInfo?.accountNumber && !paymentForm.accountNumber) {
      setError('Veuillez configurer et enregistrer vos coordonnées de paiement avant de demander un retrait.');
      return;
    }
    if (amountInCents > availableCents) {
      setError(`Montant supérieur au solde disponible (${fmt(availableCents)}).`);
      return;
    }

    setRequestingPayout(true);
    try {
      await SellerService.requestPayout(amountInCents, paymentForm.method);
      setPayoutAmount('');
      setSuccess('Votre demande de versement a été soumise avec succès.');
      await Promise.all([onPayoutsRefresh(), loadFinancials()]);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la demande de versement');
    } finally {
      setRequestingPayout(false);
    }
  };

  const LEDGER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    SALE_PENDING: { label: 'Vente en attente', color: 'bg-amber-100 text-amber-800' },
    SALE_AVAILABLE: { label: 'Vente disponible', color: 'bg-emerald-100 text-emerald-800' },
    REFUND: { label: 'Remboursement', color: 'bg-rose-100 text-rose-800' },
    PAYOUT_RESERVED: { label: 'Retrait réservé', color: 'bg-indigo-100 text-indigo-800' },
    PAYOUT_COMPLETED: { label: 'Retrait payé', color: 'bg-blue-100 text-blue-800' },
    PAYOUT_RELEASED: { label: 'Retrait libéré', color: 'bg-amber-100 text-amber-800' },
    ADJUSTMENT: { label: 'Ajustement', color: 'bg-purple-100 text-purple-800' },
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Paiements, Trésorerie & Retraits</h2>
          <p className="text-sm text-gray-500">Gérez vos revenus transparents, vos 4 soldes certifiés et vos coordonnées bancaires.</p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exportingCsv}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50 transition"
        >
          <ArrowDownTrayIcon className="w-4 h-4 text-gray-500" />
          {exportingCsv ? 'Génération...' : 'Exporter le journal comptable (CSV)'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* Explication du délai de disponibilité */}
      <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-700 mt-0.5">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-950 text-sm sm:text-base">Délai de disponibilité des fonds & Sécurité acheteur/vendeur</h4>
            <p className="text-xs sm:text-sm text-blue-800 mt-1 leading-relaxed">
              Pour assurer une totale confiance sur la marketplace MandeMarket, les recettes d'une commande payée sont d'abord placées sous le statut <strong>« En attente de livraison »</strong>. Dès que la commande est physiquement livrée et validée (statut <em>LIVRÉE</em>), les fonds nets sont automatiquement débloqués dans votre <strong>« Solde disponible »</strong> et immédiatement retirables.
            </p>
          </div>
        </div>
      </div>

      {/* 4 Balances Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Available */}
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5 bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Disponible au retrait</span>
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-700 mt-2">{fmt(availableCents)}</p>
          <p className="text-xs text-gray-500 mt-1">Fonds débloqués, immédiatement virables</p>
        </div>

        {/* Pending Delivery */}
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5 bg-gradient-to-br from-white to-amber-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">En attente de livraison</span>
            <ClockIcon className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-700 mt-2">{fmt(pendingCents)}</p>
          <p className="text-xs text-gray-500 mt-1">Commandes en cours d’acheminement</p>
        </div>

        {/* Reserved Payouts */}
        <div className="bg-white rounded-xl shadow-sm border border-indigo-200 p-5 bg-gradient-to-br from-white to-indigo-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">En cours de virement</span>
            <CreditCardIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-indigo-700 mt-2">{fmt(reservedCents)}</p>
          <p className="text-xs text-gray-500 mt-1">Demandes de retraits en traitement</p>
        </div>

        {/* Completed Payouts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 bg-gradient-to-br from-white to-gray-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Total déjà versé</span>
            <CheckCircleIcon className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-2">{fmt(paidCents)}</p>
          <p className="text-xs text-gray-500 mt-1">Versements effectués avec succès</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payout Request */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-orange-500" />
            Demander un versement
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Minimum requis : <strong>5 000 FCFA</strong>. Aucun frais caché, virement traité sous 24h à 48h.
          </p>
          <form onSubmit={requestPayout} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant à retirer (FCFA)</label>
              <div className="relative">
                <input
                  type="number"
                  min="5000"
                  max={Math.max(0, Math.floor(availableCents / 100))}
                  step="100"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="Ex: 25000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
                <span className="absolute right-3 top-2 text-xs font-medium text-gray-400">FCFA</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                <span>Disponible : {fmt(availableCents)}</span>
                {availableCents > 0 && (
                  <button
                    type="button"
                    onClick={() => setPayoutAmount(String(Math.floor(availableCents / 100)))}
                    className="text-orange-600 hover:underline font-medium"
                  >
                    Tout retirer
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={requestingPayout || !payoutAmount || availableCents < 500000 || parseFloat(payoutAmount) * 100 > availableCents}
              className="w-full py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-semibold shadow-sm transition-colors"
            >
              {requestingPayout ? 'Traitement de la demande...' : 'Confirmer la demande de versement'}
            </button>
            {availableCents < 500000 && (
              <p className="text-xs text-amber-600 text-center">
                Solde disponible insuffisant pour effectuer un retrait (min. 5 000 FCFA).
              </p>
            )}
          </form>
        </div>

        {/* Payment Info Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <CreditCardIcon className="w-5 h-5 text-orange-500" />
            Coordonnées de versement
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Indiquez le compte Mobile Money ou compte bancaire où recevoir vos fonds.
          </p>
          <form onSubmit={savePayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Méthode</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opérateur / Banque</label>
                <input
                  value={paymentForm.operator}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, operator: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  placeholder="Ex: Wave, Orange, Ecobank"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du titulaire du compte</label>
                <input
                  required
                  value={paymentForm.accountName}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, accountName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  placeholder="Nom complet tel qu'inscrit auprès de l'opérateur"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">N° de compte ou Téléphone</label>
                <input
                  required
                  value={paymentForm.accountNumber}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  placeholder="Ex: +225 07 00 00 00 00 ou IBAN"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPayment}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {savingPayment ? 'Enregistrement...' : 'Mettre à jour mes coordonnées'}
            </button>
          </form>
        </div>
      </div>

      {/* Double-Entry Ledger Entries Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Journal comptable certifié (Écritures réelles)</h3>
            <p className="text-xs text-gray-500">Traçabilité complète de chaque transaction, vente, commission et déblocage de solde.</p>
          </div>
          <span className="text-xs font-mono bg-gray-100 px-2.5 py-1 rounded text-gray-600">
            {ledgerEntries.length} écritures
          </span>
        </div>

        {ledgerEntries.length === 0 ? (
          <EmptyState message="Aucune écriture comptable enregistrée pour le moment." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type d'opération</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description / Réf</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Brut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Vendeur</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {ledgerEntries.map((e: any) => {
                  const badge = LEDGER_TYPE_LABELS[e.type] || { label: e.type, color: 'bg-gray-100 text-gray-700' };
                  const isNegative = e.type === 'REFUND' || e.type.startsWith('PAYOUT_');
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(e.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-xs sm:text-sm">{e.description || 'Opération de trésorerie'}</div>
                        <div className="text-xs text-gray-400 font-mono">
                          {e.order?.orderNumber ? `Commande #${e.order.orderNumber}` : e.payout?.reference ? `Retrait #${e.payout.reference}` : `ID: ${e.id.slice(0, 8)}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {fmt(e.amount ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600 text-xs">
                        {e.feeAmount ? `-${fmt(e.feeAmount)}` : '0 FCFA'}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {isNegative ? `-${fmt(Math.abs(e.netAmount ?? 0))}` : `+${fmt(e.netAmount ?? 0)}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payouts History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Historique des demandes de versements</h3>
        </div>
        {payouts.length === 0 ? (
          <EmptyState message="Aucune demande de versement pour le moment." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Méthode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payouts.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmt(p.amount ?? 0)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{p.method?.replace('_', ' ') || 'Mobile Money'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PAYOUT_STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {PAYOUT_STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{p.reference || p.id?.slice(0, 10) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: Profile ─────────────────────────────────────────────────────────

export function ProfileSection({
  profile,
  onProfileUpdate,
}: {
  profile: any;
  onProfileUpdate: (p: any) => void;
}) {
  const [form, setForm] = useState({
    storeName: profile?.storeName || '',
    description: profile?.description || '',
    logo: profile?.logo || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await SellerService.updateMyProfile(form);
      onProfileUpdate(form);
      setSuccess('Profil mis à jour avec succès.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Profil boutique</h2>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique</label>
            <input
              required
              value={form.storeName}
              onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              placeholder="Nom de votre boutique"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
              placeholder="Décrivez votre boutique..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo de la boutique</label>
            <CloudinaryImageUpload
              currentImage={form.logo}
              onImageChange={(url) => setForm((f) => ({ ...f, logo: url }))}
              placeholder="Choisir un logo"
              maxSize={5 * 1024 * 1024}
            />
          </div>

          {profile?.slug && (
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Lien de votre boutique :{' '}
                <Link href={`/vendeur/${profile.slug}`} className="text-orange-600 hover:underline font-medium" target="_blank">
                  /vendeur/{profile.slug}
                </Link>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
          </button>
        </form>
      </div>
    </div>
  );
}
