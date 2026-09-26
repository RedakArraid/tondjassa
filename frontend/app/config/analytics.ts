import { apiService } from './api';
import { formatCurrency as formatCurrencyFromCents } from './currency';

export interface AnalyticsData {
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
    activeThisMonth: number;
    retentionRate: number;
    customerGrowth: number;
    topCustomers: Array<{ id: string; name: string; totalSpent: number; orders: number }>;
    customersBySegment: Array<{ segment: string; count: number; revenue: number }>;
  };
  inventory: {
    totalProducts: number;
    totalStock: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    stockValue: number;
    stockHealth: number;
    stockMovement: Array<{ date: string; inbound: number; outbound: number }>;
    topMovingProducts: Array<{ id: number; name: string; movement: number; currentStock: number }>;
  };
  alerts: Array<{
    id: string;
    type: 'stock' | 'order' | 'customer' | 'system';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    timestamp: string;
    actionRequired: boolean;
  }>;
}

export interface TimeRange {
  period: '7d' | '30d' | '90d' | '1y';
  startDate?: string;
  endDate?: string;
}

function periodToDays(period: TimeRange['period']): number {
  switch (period) {
    case '7d':
      return 7;
    case '90d':
      return 90;
    case '1y':
      return 365;
    case '30d':
    default:
      return 30;
  }
}

/** Aligné sur les routes réelles `/api/dashboard/*` (pas `/api/analytics`). */
export const AnalyticsService = {
  getDashboardOverview: (timeRange: TimeRange): Promise<AnalyticsData> =>
    apiService.get(`/api/dashboard/overview?period=${periodToDays(timeRange.period)}`),

  getSalesAnalytics: (timeRange: TimeRange) =>
    apiService.get(`/api/dashboard/stats/detailed?period=${periodToDays(timeRange.period)}`),

  getCustomerAnalytics: (timeRange: TimeRange) =>
    apiService.get(`/api/dashboard/stats/detailed?period=${periodToDays(timeRange.period)}`),

  getInventoryAnalytics: (timeRange: TimeRange) =>
    apiService.get(`/api/dashboard/stats/detailed?period=${periodToDays(timeRange.period)}`),

  getAlerts: (filters?: { type?: string; priority?: string }) =>
    apiService.get(`/api/dashboard/alerts?${new URLSearchParams(filters || {})}`),

  markAlertAsRead: async (_alertId: string) => ({ ok: true }),

  getRealTimeMetrics: () =>
    apiService.get('/api/dashboard/overview?period=1'),

  exportAnalytics: (type: 'sales' | 'customers' | 'inventory', timeRange: TimeRange, _format: 'csv' | 'excel' | 'pdf') =>
    apiService.get(`/api/dashboard/stats/detailed?period=${periodToDays(timeRange.period)}&type=${type}`),
};

/** Montants API = centimes → affichage FCFA */
export const formatCurrency = (amountInCents: number): string =>
  formatCurrencyFromCents(amountInCents ?? 0);

export const formatNumber = (number: number): string => {
  return new Intl.NumberFormat('fr-FR').format(number);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatDate = (date: string | Date): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};

export const getGrowthColor = (growth: number): string => {
  if (growth > 0) return 'text-green-600';
  if (growth < 0) return 'text-red-600';
  return 'text-gray-600';
};

export const getGrowthIcon = (growth: number): string => {
  if (growth > 0) return '📈';
  if (growth < 0) return '📉';
  return '➡️';
};

export const calculateGrowth = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};
