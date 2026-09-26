'use client';

import { apiFetch as fetch, logoutSession } from '../../lib/api-fetch';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChartBarIcon,
  ShoppingBagIcon,
  UsersIcon,
  TagIcon,
  CogIcon,
  BellIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  BuildingStorefrontIcon,
  BanknotesIcon,
  ChatBubbleLeftRightIcon,
  ArrowUturnLeftIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import AuthGuard from '../components/AuthGuard';
import ProductsManager from '../components/ProductsManager';
import CategoriesManager from '../components/CategoriesManager';
import OrdersManager from '../components/OrdersManager';
import CustomersManager from '../components/CustomersManager';
import KPIGrid from '../components/KPIGrid';
import SalesCharts from '../components/SalesCharts';
import AlertsManager from '../components/AlertsManager';
import SellersManager from '../components/SellersManager';
import PayoutsManager from '../components/PayoutsManager';
import UsersManager from '../components/UsersManager';
import ReviewsModerationManager from '../components/ReviewsModerationManager';
import ReturnsModerationManager from '../components/ReturnsModerationManager';
import AuditLogsManager from '../components/AuditLogsManager';
import { apiService, CategoryService, SellerService } from '../../config/api';

// Interface Category définie localement
interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  image?: string;
  status: 'active' | 'inactive';
  productCount?: number;
}

// Types
interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface DashboardStats {
  sales: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    revenueGrowth: number;
    dailyRevenue: Array<{ date?: string; month?: string; revenue: number; orders: number }>;
    monthlyRevenue: Array<{ date?: string; month?: string; revenue: number; orders: number }>;
    topProducts: Array<{ id: number; name: string; revenue: number; units: number }>;
    revenueByCategory: Array<{ category: string; revenue: number; percentage: number }>;
  };
  customers: {
    total: number;
    newThisMonth: number;
    customerGrowth: number;
  };
  inventory: {
    totalProducts: number;
    stockValue: number;
    lowStockProducts: number;
    stockHealth: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // États pour les données
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState([]);
  const [marketplaceStats, setMarketplaceStats] = useState<{
    sellersTotal: number;
    sellersApproved: number;
    sellersPending: number;
    payoutsPending: number;
    payoutsTotalAmount: number;
  } | null>(null);

  // États pour la navigation
  const [activeSection, setActiveSection] = useState<'dashboard' | 'products' | 'categories' | 'orders' | 'customers' | 'vendeurs' | 'payouts' | 'utilisateurs' | 'avis' | 'retours' | 'audit'>('dashboard');

  // Vérifier l'authentification au chargement (admin/manager uniquement, pas vendeurs)
  useEffect(() => {
    const savedToken = sessionStorage.getItem('admin_token');
    const savedUser = sessionStorage.getItem('admin_user');
    
    if (!savedToken || !savedUser) {
      router.push('/admin/login');
      return;
    }
    const parsedUser = JSON.parse(savedUser);
    // Les vendeurs doivent utiliser leur espace /vendeur, pas l'admin
    if (parsedUser?.role === 'seller') {
      router.push('/vendeur/dashboard');
      return;
    }
    if (parsedUser?.role === 'support') {
      router.push('/support/dashboard');
      return;
    }
    setToken(savedToken);
    setUser(parsedUser);
    setLoading(false);
  }, [router]);

  // Charger les données du tableau de bord
  useEffect(() => {
    if (user && token) {
      loadDashboardData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      
      if (!token) return;

      // Charger les vraies données depuis l'API
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
      
      const [dashboardRes, categoriesRes, alertsRes, sellersRes, payoutsRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/dashboard/overview?period=30`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json()),
        CategoryService.getAll(),
        fetch(`${API_URL}/api/dashboard/alerts`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json()),
        (user?.role === 'admin' || user?.role === 'manager') ? SellerService.adminGetAll() : Promise.resolve(null),
        (user?.role === 'admin' || user?.role === 'manager') ? SellerService.adminGetPayouts('pending') : Promise.resolve([])
      ]);

      // Charger les données du dashboard
      if (dashboardRes.status === 'fulfilled') {
        const dashData = dashboardRes.value;
        
        // Formater les données pour correspondre à l'interface DashboardStats
        const formattedStats: DashboardStats = {
          sales: {
            totalRevenue: dashData.sales?.totalRevenue || 0,
            totalOrders: dashData.sales?.totalOrders || 0,
            averageOrderValue: dashData.sales?.averageOrderValue || 0,
            revenueGrowth: dashData.sales?.revenueGrowth || 0,
            dailyRevenue: dashData.sales?.dailyRevenue || [],
            monthlyRevenue: dashData.sales?.monthlyRevenue || [],
            topProducts: dashData.sales?.topProducts || [],
            revenueByCategory: dashData.sales?.revenueByCategory || []
          },
          customers: {
            total: dashData.customers?.total || 0,
            newThisMonth: dashData.customers?.newThisMonth || 0,
            customerGrowth: dashData.customers?.customerGrowth || 0
          },
          inventory: {
            totalProducts: dashData.inventory?.totalProducts || 0,
            stockValue: dashData.inventory?.stockValue || 0,
            lowStockProducts: dashData.inventory?.lowStockProducts || 0,
            stockHealth: dashData.inventory?.stockHealth || 0
          }
        };
        
        setStats(formattedStats);
        console.log('✅ Données du dashboard chargées depuis la BDD:', formattedStats);
      } else {
        console.error('Erreur chargement dashboard:', dashboardRes.reason);
      }

      // Charger les catégories
      if (categoriesRes.status === 'fulfilled') {
        setCategories(categoriesRes.value);
      }
      
      // Charger les alertes
      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value);
      }

      // Stats marketplace (admin/manager)
      if ((user?.role === 'admin' || user?.role === 'manager') && sellersRes.status === 'fulfilled' && sellersRes.value) {
        const sellers = Array.isArray(sellersRes.value) ? sellersRes.value : (sellersRes.value as any).sellers || [];
        const approved = sellers.filter((s: any) => s.status === 'approved').length;
        const pending = sellers.filter((s: any) => s.status === 'pending').length;
        const payouts = payoutsRes.status === 'fulfilled' && Array.isArray(payoutsRes.value) ? payoutsRes.value : [];
        const payoutsTotalAmount = payouts.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        setMarketplaceStats({
          sellersTotal: sellers.length,
          sellersApproved: approved,
          sellersPending: pending,
          payoutsPending: payouts.length,
          payoutsTotalAmount
        });
      }
      
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try { await logoutSession('staff'); } catch (error) { window.alert(error instanceof Error ? error.message : 'Deconnexion non confirmee'); return; }
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
    router.push('/admin/login');
  };

  const handleDataChange = () => {
    loadDashboardData();
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  // Page de chargement
  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">MandeMarket Admin</h2>
          <p className="text-gray-600">Chargement du dashboard analytics...</p>
        </div>
      </div>
    );
  }

  // Redirection si non connecté
  if (!user) {
    return null;
  }

  // Interface principale
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-brand-cream lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full bg-brand-navy text-white flex flex-col justify-between shadow-lg lg:w-64 lg:flex-shrink-0">
          <div>
            <div className="p-6 border-b border-white/10">
              <h1 className="text-2xl font-extrabold">
                <span className="text-white">Mande</span>
                <span className="text-brand-orange">Market</span>
              </h1>
              <p className="text-brand-orange font-medium text-sm mt-1">{user.role === 'admin' ? 'Super Admin' : 'Manager · accès opérationnel'}</p>
              <p className="text-sm text-white/50 mt-1 truncate">{user.email}</p>
            </div>
            
            <nav className="flex flex-col gap-1 p-4">
              <button
                onClick={() => setActiveSection('dashboard')}
                className={`text-left px-4 py-2.5 rounded-lg transition-colors flex items-center gap-3 ${
                  activeSection === 'dashboard' 
                    ? 'bg-brand-orange text-white' 
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <ChartBarIcon className="w-5 h-5" />
                Tableau de bord
              </button>
              
              <button
                onClick={() => setActiveSection('products')}
                className={`text-left px-4 py-2.5 rounded-lg transition-colors flex items-center gap-3 ${
                  activeSection === 'products' 
                    ? 'bg-brand-orange text-white' 
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <ShoppingBagIcon className="w-5 h-5" />
                Produits
              </button>
              
              <button
                onClick={() => setActiveSection('categories')}
                className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                  activeSection === 'categories' 
                    ? 'bg-brand-orange text-white' 
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <TagIcon className="w-5 h-5" />
                Catégories
              </button>
              
              <button
                onClick={() => setActiveSection('orders')}
                className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                  activeSection === 'orders' 
                    ? 'bg-brand-orange text-white' 
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <CogIcon className="w-5 h-5" />
                Commandes
              </button>
              
              <button
                onClick={() => setActiveSection('customers')}
                className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                  activeSection === 'customers' 
                    ? 'bg-brand-orange text-white' 
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <UsersIcon className="w-5 h-5" />
                Clients
              </button>
              
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <>
                  <button
                    onClick={() => setActiveSection('vendeurs')}
                    className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                      activeSection === 'vendeurs' 
                        ? 'bg-brand-orange text-white' 
                    : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <BuildingStorefrontIcon className="w-5 h-5" />
                    Vendeurs
                  </button>
                  <button
                    onClick={() => setActiveSection('payouts')}
                    className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                      activeSection === 'payouts'
                        ? 'bg-brand-orange text-white'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <BanknotesIcon className="w-5 h-5" />
                    Versements
                  </button>
                  <button
                    onClick={() => setActiveSection('avis')}
                    className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                      activeSection === 'avis'
                        ? 'bg-brand-orange text-white'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    Avis clients
                  </button>
                  <button
                    onClick={() => setActiveSection('retours')}
                    className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                      activeSection === 'retours'
                        ? 'bg-brand-orange text-white'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <ArrowUturnLeftIcon className="w-5 h-5" />
                    Retours & Litiges
                  </button>
                </>
              )}
              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => setActiveSection('utilisateurs')}
                    className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                      activeSection === 'utilisateurs'
                        ? 'bg-brand-orange text-white'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <UsersIcon className="w-5 h-5" />
                    Utilisateurs
                  </button>
                  <button
                    onClick={() => setActiveSection('audit')}
                    className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                      activeSection === 'audit'
                        ? 'bg-brand-orange text-white'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <ShieldCheckIcon className="w-5 h-5" />
                    Audit système
                  </button>
                </>
              )}
            </nav>
          </div>
          
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/20 text-red-300 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
            >
              Déconnexion
            </button>
          </div>
        </aside>

        {/* Contenu principal */}
        <main className="min-w-0 w-full flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {activeSection === 'dashboard' && (
            <DashboardAnalytics 
              stats={stats} 
              alerts={alerts} 
              loading={refreshing}
              onRefresh={handleRefresh}
              marketplaceStats={marketplaceStats}
              onNavigatePayouts={() => setActiveSection('payouts')}
              onNavigateVendeurs={() => setActiveSection('vendeurs')}
            />
          )}
          
          {activeSection === 'products' && (
            <ProductsManager 
              categories={categories} 
              onProductChange={handleDataChange} 
            />
          )}
          
          {activeSection === 'categories' && (
            <CategoriesManager 
              onCategoryChange={handleDataChange} 
            />
          )}
          
          {activeSection === 'orders' && token && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Commandes</h1>
              <OrdersManager token={token} />
            </div>
          )}
          
          {activeSection === 'customers' && token && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Clients</h1>
              <CustomersManager token={token} />
            </div>
          )}
          
          {activeSection === 'vendeurs' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Vendeurs (Marketplace)</h1>
              <SellersManager readOnly={user.role !== 'admin'} />
            </div>
          )}
          {activeSection === 'payouts' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">Versements vendeurs</h1>
              <PayoutsManager readOnly={user.role !== 'admin'} />
            </div>
          )}
          {activeSection === 'utilisateurs' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Utilisateurs</h1>
              <UsersManager token={token!} currentRole={user.role} />
            </div>
          )}
          {activeSection === 'avis' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">Modération des Avis</h1>
              <ReviewsModerationManager />
            </div>
          )}
          {activeSection === 'retours' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des Retours</h1>
              <ReturnsModerationManager canRefund={user.role === 'admin'} />
            </div>
          )}
          {activeSection === 'audit' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">Journal d’Audit Système</h1>
              <AuditLogsManager />
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

// Composant Dashboard Analytics Principal
function DashboardAnalytics({ 
  stats, 
  alerts, 
  loading,
  onRefresh,
  marketplaceStats,
  onNavigatePayouts,
  onNavigateVendeurs
}: { 
  stats: DashboardStats | null; 
  alerts: any[]; 
  loading: boolean;
  onRefresh: () => void;
  marketplaceStats?: { sellersTotal: number; sellersApproved: number; sellersPending: number; payoutsPending: number; payoutsTotalAmount: number } | null;
  onNavigatePayouts?: () => void;
  onNavigateVendeurs?: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Header avec bouton refresh */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Analytics</h1>
          <p className="text-gray-600 mt-1">Vue d'ensemble de votre activité e-commerce</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Stats Marketplace */}
      {marketplaceStats && (onNavigateVendeurs || onNavigatePayouts) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={onNavigateVendeurs}
            className="bg-white rounded-xl p-4 shadow border border-orange-100 hover:border-orange-300 text-left transition-colors"
          >
            <BuildingStorefrontIcon className="w-8 h-8 text-orange-500 mb-2" />
            <p className="text-sm text-gray-500">Vendeurs</p>
            <p className="text-2xl font-bold text-gray-900">{marketplaceStats.sellersTotal} total ({marketplaceStats.sellersApproved} actifs)</p>
          </button>
          <button
            onClick={onNavigatePayouts}
            className="bg-white rounded-xl p-4 shadow border border-orange-100 hover:border-orange-300 text-left transition-colors"
          >
            <BanknotesIcon className="w-8 h-8 text-orange-500 mb-2" />
            <p className="text-sm text-gray-500">Versements en attente</p>
            <p className="text-2xl font-bold text-gray-900">{marketplaceStats.payoutsPending}</p>
          </button>
        </div>
      )}

      {/* KPIs principaux */}
      <KPIGrid
        data={stats}
        loading={loading}
        marketplaceData={marketplaceStats ? {
          sellersTotal: marketplaceStats.sellersTotal,
          sellersApproved: marketplaceStats.sellersApproved,
          sellersPending: marketplaceStats.sellersPending || 0,
          payoutsPending: marketplaceStats.payoutsPending,
          payoutsTotalAmount: marketplaceStats.payoutsTotalAmount || 0
        } : undefined}
      />

      {/* Graphiques de ventes */}
      <SalesCharts data={stats?.sales || null} loading={loading} />

      {/* Alertes */}
      <AlertsManager alerts={alerts} loading={loading} />
    </div>
  );
}

// Placeholders supprimés - Les vrais composants OrdersManager et CustomersManager sont maintenant utilisés
