import { apiFetch as fetch } from '../lib/api-fetch';
// Configuration API centralisée pour MandeMarket
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export const apiEndpoints = {
  auth: {
    login: '/api/auth/login',
    signup: '/api/auth/signup',
    verify: '/api/auth/verify',
    logout: '/api/auth/logout',
  },
  products: '/api/products',
  categories: '/api/categories',
  orders: '/api/orders',
  customers: '/api/customers',
  dashboard: '/api/dashboard',
  sellers: '/api/sellers',
};

// Service API avec gestion d'erreur robuste
class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Ajouter le token d'authentification si disponible
    const token = this.getAuthToken();
    if (token) {
      defaultOptions.headers = {
        ...defaultOptions.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    try {
      console.log(`🔄 API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ API Error ${response.status}:`, errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ API Success: ${options.method || 'GET'} ${url}`);
      return data;
    } catch (error) {
      console.error('🚨 API Network Error:', error);
      throw error;
    }
  }

  // Méthodes HTTP
  async get(endpoint: string, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint: string, data?: any, options?: RequestInit) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(endpoint: string, data?: any, options?: RequestInit) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string, options?: RequestInit) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
      method: 'DELETE',
    };

    // Ajouter le token d'authentification si disponible
    const token = this.getAuthToken();
    if (token) {
      defaultOptions.headers = {
        ...defaultOptions.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    try {
      console.log(`🔄 API Request: DELETE ${url}`);
      
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ API Error ${response.status}:`, errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      // Si status 204 (No Content), retourner null
      if (response.status === 204) {
        console.log(`✅ API Success: DELETE ${url} (No Content)`);
        return null;
      }
      
      // Sinon retourner les données JSON
      const data = await response.json();
      console.log(`✅ API Success: DELETE ${url}`, data);
      return data;
    } catch (error) {
      console.error('🚨 API Network Error:', error);
      throw error;
    }
  }

  // Gestion du token d'authentification
  getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('admin_token');
    }
    return null;
  }

  setAuthToken(token: string) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_token', token);
    }
  }

  removeAuthToken() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_token');
    }
  }

  // Aucune donnée commerciale fictive n'est injectée lorsque l'API est indisponible.
  // Test de connectivité
  async testConnection(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export const apiService = new ApiService();

// Services spécialisés avec fallback automatique
export class ProductService {
  static async getAll() {
    try {
      const response = await apiService.get('/api/products?limit=500');
      return response.products || response || [];
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      return [];
    }
  }

  static async getPaginated(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    sortBy?: string;
    sellerId?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.page)       qs.set('page',       String(params.page));
    if (params.limit)      qs.set('limit',      String(params.limit));
    if (params.search)     qs.set('search',     params.search);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.sortBy)     qs.set('sortBy',     params.sortBy);
    if (params.sellerId)   qs.set('sellerId',   params.sellerId);
    try {
      const response = await apiService.get(`/api/products?${qs.toString()}`);
      return {
        products:   response.products || [],
        pagination: response.pagination || { page: 1, limit: 24, total: 0, totalPages: 1 },
      };
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      return { products: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 1 } };
    }
  }

  static async getById(id: string) {
    try {
      const response = await apiService.get(`/api/products/${id}`);
      return response.product || response;
    } catch (error) {
      console.error('Erreur lors du chargement du produit:', error);
      return null;
    }
  }

  static async create(productData: any) {
    try {
      const response = await apiService.post('/api/products', productData);
      return response.product || response;
    } catch (error) {
      console.error('Erreur lors de la création du produit:', error);
      throw error;
    }
  }

  static async update(id: string, productData: any) {
    try {
      const response = await apiService.put(`/api/products/${id}`, productData);
      return response.product || response;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du produit:', error);
      throw error;
    }
  }

  static async delete(id: string) {
    try {
      return await apiService.delete(`/api/products/${id}`);
    } catch (error) {
      console.error('Erreur lors de la suppression du produit:', error);
      throw error;
    }
  }

  static async uploadImage(file: File): Promise<{ url: string; publicId: string }> {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const token = apiService.getAuthToken();
      const url = `${apiService['baseURL']}/api/products/upload`;

      console.log('📤 Uploading image to Cloudinary...');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de l\'upload de l\'image');
      }

      const data = await response.json();
      console.log('✅ Image uploaded to Cloudinary:', data.url);

      return {
        url: data.url,
        publicId: data.publicId
      };
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload de l\'image:', error);
      throw error;
    }
  }
}

export class CategoryService {
  static async getAll() {
    try {
      const response = await apiService.get('/api/categories');
      return response.categories || response || [];
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
      return [];
    }
  }

  static async getById(id: string) {
    try {
      const response = await apiService.get(`/api/categories/${id}`);
      return response.category || response;
    } catch (error) {
      console.error('Erreur lors du chargement de la catégorie:', error);
      return null;
    }
  }

  static async create(categoryData: any) {
    try {
      const response = await apiService.post('/api/categories', categoryData);
      return response.category || response;
    } catch (error) {
      console.error('Erreur lors de la création de la catégorie:', error);
      throw error;
    }
  }

  static async update(id: string, categoryData: any) {
    try {
      const response = await apiService.put(`/api/categories/${id}`, categoryData);
      return response.category || response;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la catégorie:', error);
      throw error;
    }
  }

  static async delete(id: string) {
    try {
      return await apiService.delete(`/api/categories/${id}`);
    } catch (error) {
      console.error('Erreur lors de la suppression de la catégorie:', error);
      throw error;
    }
  }
}

export class SellerService {
  static async getAll(params?: { page?: number; search?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.search) q.set('search', params.search);
    const query = q.toString();
    const response = await apiService.get(`/api/sellers${query ? `?${query}` : ''}`);
    return response;
  }

  static async getBySlug(slug: string) {
    return apiService.get(`/api/sellers/slug/${slug}`);
  }

  static async register(data: { storeName: string; slug?: string; description?: string; logo?: string }) {
    return apiService.post('/api/sellers/register', data);
  }

  static async getMyStatus() {
    return apiService.get('/api/sellers/me/status');
  }

  static async getMyProfile() {
    return apiService.get('/api/sellers/me/profile');
  }

  static async updateMyProfile(data: { storeName?: string; description?: string; logo?: string; paymentInfo?: { method: string; accountNumber: string; accountName: string; operator?: string } }) {
    return apiService.put('/api/sellers/me/profile', data);
  }

  static async getMyProducts(
    pageOrOpts: number | { page?: number; limit?: number; status?: string; search?: string; categoryId?: string; stockStatus?: string } = 1,
    limitArg = 20,
    optsArg: { status?: string; search?: string; categoryId?: string; stockStatus?: string } = {}
  ) {
    let page = 1;
    let limit = 20;
    let opts: { status?: string; search?: string; categoryId?: string; stockStatus?: string } = {};

    if (typeof pageOrOpts === 'object' && pageOrOpts !== null) {
      page = pageOrOpts.page || 1;
      limit = pageOrOpts.limit || 20;
      opts = pageOrOpts;
    } else {
      page = typeof pageOrOpts === 'number' ? pageOrOpts : 1;
      limit = limitArg;
      opts = optsArg;
    }

    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (opts.status) q.set('status', opts.status);
    if (opts.search) q.set('search', opts.search);
    if (opts.categoryId) q.set('categoryId', opts.categoryId);
    if (opts.stockStatus) q.set('stockStatus', opts.stockStatus);
    return apiService.get(`/api/sellers/me/products?${q}`);
  }

  static async downloadProductsCsv() {
    const token = apiService.getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/sellers/me/products/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Erreur lors du téléchargement du fichier CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produits-mandemarket-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  static async bulkProductsAction(action: 'activate' | 'deactivate' | 'archive' | 'delete', productIds: number[]) {
    return apiService.post('/api/sellers/me/products/bulk', { action, productIds });
  }

  static async duplicateProduct(id: number) {
    return apiService.post(`/api/sellers/me/products/${id}/duplicate`);
  }

  static async updateProductStatus(id: number, status: 'active' | 'draft' | 'archived') {
    return apiService.put(`/api/sellers/me/products/${id}/status`, { status });
  }

  static async updateProductStock(id: number, quantity: number, lowStockThreshold = 5) {
    return apiService.put(`/api/sellers/me/products/${id}/stock`, { quantity, lowStockThreshold });
  }

  static async getProductStats(id: number) {
    return apiService.get(`/api/sellers/me/products/${id}/stats`);
  }

  static async getMyOrders(page = 1, limit = 20, status?: string, search?: string) {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    return apiService.get(`/api/sellers/me/orders?${q}`);
  }

  static async getMyOrder(id: string) {
    return apiService.get(`/api/sellers/me/orders/${id}`);
  }

  static async updateMyOrderStatus(id: string, status: string, details?: { carrierName?: string; trackingNumber?: string; note?: string }) {
    return apiService.put(`/api/sellers/me/orders/${id}/status`, { status, ...details });
  }

  static async getPackingSlip(id: string) {
    return apiService.get(`/api/sellers/me/orders/${id}/packing-slip`);
  }

  static async getMyReviews() {
    return apiService.get('/api/sellers/me/reviews');
  }

  static async replyToReview(id: string, reply: string) {
    return apiService.post(`/api/sellers/me/reviews/${id}/reply`, { reply });
  }

  static async getMyNotifications() {
    return apiService.get('/api/sellers/me/notifications');
  }

  static async markNotificationRead(id: string) {
    return apiService.put(`/api/sellers/me/notifications/${id}/read`);
  }

  static async markAllNotificationsRead() {
    return apiService.post('/api/sellers/me/notifications/read-all');
  }

  static async getMySupportTickets() {
    return apiService.get('/api/sellers/me/support/tickets');
  }

  static async createSupportTicket(data: { category: string; subject: string; message: string }) {
    return apiService.post('/api/sellers/me/support/tickets', data);
  }

  static async getMyCustomers() {
    return apiService.get('/api/sellers/me/customers');
  }

  static async sendMessageToCustomer(data: { customerEmail: string; subject?: string; content: string }) {
    return apiService.post('/api/sellers/me/messages/send', data);
  }

  static async getMyPromotions() {
    return apiService.get('/api/sellers/me/promotions');
  }

  static async createPromotion(data: any) {
    return apiService.post('/api/sellers/me/promotions', data);
  }

  static async deletePromotion(id: string) {
    return apiService.delete(`/api/sellers/me/promotions/${id}`);
  }

  static async getMySettings() {
    return apiService.get('/api/sellers/me/settings');
  }

  static async updateMySettings(data: any) {
    return apiService.put('/api/sellers/me/settings', data);
  }

  static async getMyTeam() {
    return apiService.get('/api/sellers/me/team');
  }

  static async inviteTeamMember(email: string, role: string) {
    return apiService.post('/api/sellers/me/team/invite', { email, role });
  }

  static async getMyEarnings() {
    return apiService.get('/api/sellers/me/earnings');
  }

  static async getMyBalance() {
    return apiService.get('/api/sellers/me/balance');
  }

  static async getMyLedger(page = 1, limit = 20) {
    return apiService.get(`/api/sellers/me/ledger?page=${page}&limit=${limit}`);
  }

  static async downloadLedgerCsv() {
    const token = apiService.getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/sellers/me/ledger/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Erreur lors du téléchargement du fichier CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mandemarket-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  static async adminGetAll(status?: string) {
    const q = status ? `?status=${status}` : '';
    return apiService.get(`/api/sellers/admin/all${q}`);
  }

  static async adminApprove(sellerId: string, data: { status: 'approved' | 'suspended'; commissionRate?: number }) {
    return apiService.put(`/api/sellers/admin/${sellerId}/approve`, data);
  }

  static async requestPayout(amount: number, method?: string) {
    return apiService.post('/api/sellers/me/payouts', { amount, method });
  }

  static async getMyPayouts() {
    return apiService.get('/api/sellers/me/payouts');
  }

  static async adminGetPayouts(status?: string) {
    const q = status ? `?status=${status}` : '';
    return apiService.get(`/api/sellers/admin/payouts${q}`);
  }

  static async adminUpdatePayout(payoutId: string, data: { status?: string; reference?: string }) {
    return apiService.put(`/api/sellers/admin/payouts/${payoutId}`, data);
  }
}

export class AuthService {
  static async login(email: string, password: string) {
    try {
      const response = await apiService.post('/api/auth/login', { email, password });
      if (response.token) {
        apiService.setAuthToken(response.token);
      }
      return response;
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      throw error;
    }
  }

  static async verify() {
    try {
      const response = await apiService.get('/api/auth/verify');
      return response;
    } catch (error) {
      console.error('Erreur lors de la vérification du token:', error);
      apiService.removeAuthToken();
      throw error;
    }
  }

  static async signupSeller(data: { email: string; password: string; name?: string; storeName: string; slug?: string; description?: string }) {
    try {
      const response = await apiService.post('/api/auth/signup-seller', data);
      if (response.token) apiService.setAuthToken(response.token);
      return response;
    } catch (error) {
      console.error('Erreur inscription vendeur:', error);
      throw error;
    }
  }

  static async logout() {
    try {
      await apiService.post('/api/auth/logout');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      apiService.removeAuthToken();
    }
  }

  static async changePassword(oldPassword: string, newPassword: string) {
    return apiService.post('/api/auth/change-password', { oldPassword, newPassword });
  }

  static async logoutAllSessions() {
    return apiService.post('/api/auth/logout-all');
  }

  static async getSessions() {
    return apiService.get('/api/auth/sessions');
  }

  static async revokeSession(id: string) {
    return apiService.delete(`/api/auth/sessions/${id}`);
  }

  static isAuthenticated(): boolean {
    return !!apiService.getAuthToken();
  }

  static getToken(): string | null {
    return apiService.getAuthToken();
  }
}

export class ReviewService {
  static async getByProductId(productId: number) {
    try {
      const response = await apiService.get(`/api/reviews/${productId}`);
      return response.reviews || [];
    } catch (error) {
      console.error('Erreur lors du chargement des avis:', error);
      return [];
    }
  }

  static async getStats(productId: number) {
    try {
      const response = await apiService.get(`/api/reviews/${productId}/stats`);
      return response.stats || null;
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      return null;
    }
  }

  static async create(reviewData: {
    productId: number;
    customerName: string;
    customerEmail?: string;
    rating: number;
    title?: string;
    comment: string;
  }) {
    const customerToken = typeof window !== 'undefined'
      ? sessionStorage.getItem('mandemarket_customer_token')
      : null;
    const response = await fetch(`${API_BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
      },
      body: JSON.stringify(reviewData),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Erreur lors de la création de l\'avis');
    return data.review || data;
  }

  static async markHelpful(reviewId: string) {
    try {
      const response = await apiService.put(`/api/reviews/${reviewId}/helpful`);
      return response.review || response;
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      throw error;
    }
  }
}

export class AdminService {
  static async getUsers(page = 1, limit = 20, search?: string, role?: string) {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) q.set('search', search);
    if (role) q.set('role', role);
    return apiService.get(`/api/admin/users?${q}`);
  }

  static async createUser(data: { email: string; name?: string; password: string; role: string }) {
    return apiService.post('/api/admin/users', data);
  }

  static async updateUserRole(id: string, role: string) {
    return apiService.put(`/api/admin/users/${id}/role`, { role });
  }

  static async revokeUserSessions(id: string) {
    return apiService.post(`/api/admin/users/${id}/revoke-sessions`);
  }

  static async getUserAudit(id: string) {
    return apiService.get(`/api/admin/users/${id}/audit`);
  }

  static async getAuditLogs(page = 1, limit = 50, entity?: string, action?: string) {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (entity) q.set('entity', entity);
    if (action) q.set('action', action);
    return apiService.get(`/api/admin/audit-logs?${q}`);
  }

  static async getReviews(status?: string, page = 1, limit = 50) {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) q.set('status', status);
    return apiService.get(`/api/admin/reviews?${q}`);
  }

  static async moderateReview(id: string, status: 'approved' | 'rejected' | 'pending') {
    return apiService.put(`/api/admin/reviews/${id}/moderate`, { status });
  }

  static async getReturns(status?: string, page = 1, limit = 50) {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) q.set('status', status);
    return apiService.get(`/api/admin/returns?${q}`);
  }

  static async approveReturn(id: string) {
    return apiService.post(`/api/admin/returns/${id}/approve`);
  }

  static async rejectReturn(id: string, reason?: string) {
    return apiService.post(`/api/admin/returns/${id}/reject`, { reason });
  }

  static async processRefund(id: string, itemsReceived = false) {
    return apiService.post(`/api/admin/returns/${id}/process-refund`, { itemsReceived });
  }
}

export class AccountService {
  private static getCustomerToken(): string | null {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('mandemarket_customer_token');
    }
    return null;
  }

  private static async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getCustomerToken();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erreur requête (${res.status})`);
    }
    return data;
  }

  static async getMe() {
    return this.request('/api/account/me');
  }

  static async updateProfile(data: { firstName?: string; lastName?: string; phone?: string | null }) {
    return this.request('/api/account/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request('/api/account/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async getAddress() {
    return this.request('/api/account/address');
  }

  static async saveAddress(data: { street: string; city: string; postalCode?: string; country: string; isDefault?: boolean }) {
    return this.request('/api/account/address', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async deleteAddress() {
    return this.request('/api/account/address', {
      method: 'DELETE',
    });
  }

  static async getOrders(page = 1, limit = 10) {
    return this.request(`/api/account/orders?page=${page}&limit=${limit}`);
  }

  static async getOrder(id: string) {
    return this.request(`/api/account/orders/${id}`);
  }

  static async cancelOrder(id: string, reason?: string) {
    return this.request(`/api/account/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  static async requestReturn(id: string, data: { reason: string; description?: string }) {
    return this.request(`/api/account/orders/${id}/return-request`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getReturns() {
    return this.request('/api/account/returns');
  }

  static async deleteAccount(password: string) {
    return this.request('/api/account/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  }
}

export class ContactService {
  static async sendMessage(data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    honeypot?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Erreur lors de l’envoi de votre message');
    return json;
  }

  static async subscribeNewsletter(email: string) {
    const res = await fetch(`${API_BASE_URL}/api/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Erreur lors de l’inscription');
    return json;
  }

  static async unsubscribeNewsletter(email: string) {
    const res = await fetch(`${API_BASE_URL}/api/newsletter/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Erreur lors de la désinscription');
    return json;
  }
}

export default apiService;


