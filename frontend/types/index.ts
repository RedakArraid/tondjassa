// Types unifiés pour le projet MandeMarket
// Ces types doivent correspondre exactement au schéma Prisma

export interface User {
  id: string;
  email: string;
  password?: string; // Jamais exposé côté frontend
  name?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: 'active' | 'inactive';
  // Hiérarchie : sous-catégories
  parentId?: string | null;
  parent?: Category;
  subcategories?: Category[];
  displayOrder: number;
  // Relations
  products?: Product[];
  productCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Seller {
  id: string;
  storeName: string;
  slug: string;
  description?: string;
  logo?: string;
  status: 'pending' | 'approved' | 'suspended';
  commissionRate: number;
  totalSales: number;
  totalEarnings: number;
  rating: number;
  reviewCount: number;
  productCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Product {
  id: number;
  name: string;
  price: number; // TOUJOURS en centimes pour éviter les erreurs de calcul
  categoryId: string;
  category?: Category;
  sellerId?: string;
  seller?: Seller;
  image?: string;
  images?: string[]; // Galerie d'images multiples
  description: string;
  stock: number;
  status: 'active' | 'inactive';
  
  // Attributs métier spécialisés
  sku?: string;
  material?: string;
  lining?: string;
  coating?: string;
  dimensions?: string;
  weight?: number;
  shape?: string;
  styles?: string[];
  pattern?: string;
  decoration?: string;
  closure?: string;
  handles?: string;
  season?: string;
  occasion?: string;
  features?: string[];
  colors?: string[];
  gender?: string;
  ageGroup?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: Address;
  orders?: Order[];
  totalSpent: number; // En centimes
  loyaltyPoints: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: string;
  customerId: string;
  customer?: Customer;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  customerId: string;
  customer?: Customer;
  userId?: string;
  user?: User;
  status: OrderStatus;
  totalAmount: number; // En centimes
  taxAmount: number; // En centimes
  shippingCost: number; // En centimes
  discountAmount: number; // En centimes
  promotionCode?: string;
  items: OrderItem[];
  payment?: Payment;
  shipping?: Shipping;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  order?: Order;
  productId: number;
  product?: Product;
  quantity: number;
  unitPrice: number; // En centimes
  totalPrice: number; // En centimes
  createdAt: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  order?: Order;
  amount: number; // En centimes
  method: string;
  status: PaymentStatus;
  transactionId?: string;
  gateway?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Shipping {
  id: string;
  orderId: string;
  order?: Order;
  method: ShippingMethod;
  status: ShippingStatus;
  trackingCode?: string;
  carrier?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  type: PromotionType;
  value: number; // En centimes pour FIXED_AMOUNT, en pourcentage pour PERCENTAGE
  minAmount?: number; // En centimes
  maxUses?: number;
  usedCount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Inventory {
  id: string;
  productId: number;
  product?: Product;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  lastUpdated: Date;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  userId?: string;
  user?: User;
  metadata?: any;
  createdAt: Date;
}

export interface Review {
  id: string;
  productId: number;
  product?: Product;
  customerName: string;
  customerEmail?: string;
  rating: number; // 1-5 étoiles
  title?: string;
  comment: string;
  sellerReply?: string | null;
  sellerReplyAt?: Date | string | null;
  isVerified: boolean;
  helpful: number;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewStats {
  total: number;
  averageRating: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

// Enums
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum ShippingMethod {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
  PICKUP = 'PICKUP'
}

export enum ShippingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED'
}

export enum PromotionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_SHIPPING = 'FREE_SHIPPING'
}

export enum NotificationType {
  ORDER_STATUS = 'ORDER_STATUS',
  STOCK_ALERT = 'STOCK_ALERT',
  PAYMENT = 'PAYMENT',
  SHIPPING = 'SHIPPING',
  SYSTEM = 'SYSTEM'
}

// Types pour l'API et les réponses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  sales: {
    totalRevenue: number; // En centimes
    totalOrders: number;
    averageOrderValue: number; // En centimes
    revenueGrowth: number; // En pourcentage
  };
  inventory: {
    totalProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    stockHealth: number; // En pourcentage
  };
  customers: {
    total: number;
    new: number;
    active: number;
    retentionRate: number; // En pourcentage
  };
}

// Types pour les formulaires
export interface ProductFormData extends Omit<Product, 'id' | 'createdAt' | 'updatedAt'> {}
export interface CategoryFormData extends Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'products' | 'parent' | 'subcategories'> {}
export interface CustomerFormData extends Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'orders' | 'totalSpent'> {}

// Types pour l'authentification
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'password'>;
}

// Utilitaires de formatage
export const formatPrice = (priceInCents: number): string => {
  return `${(priceInCents / 100).toFixed(0)} FCFA`;
};

export const formatPriceForInput = (priceInCents: number): number => {
  return priceInCents / 100;
};

export const parsePrice = (priceInEuros: number): number => {
  return Math.round(priceInEuros * 100);
};

// Constantes pour les filtres et options
export const MATERIALS = [
  'Cuir PU',
  'Cuir synthétique', 
  'Cuir véritable',
  'Toile enduite',
  'Nylon renforcé',
  'Coton canvas',
  'Satin'
] as const;

export const SHAPES = [
  'Rectangle',
  'Carré', 
  'Rond',
  'Trapèze',
  'Ergonomique',
  'Classique',
  'Compact',
  'Cabas',
  'Pochette'
] as const;

export const STYLES = [
  'Mode',
  'Luxe',
  'Vintage',
  'Décontracté',
  'Business',
  'Moderne',
  'Élégant',
  'Rétro',
  'Sophistiqué',
  'Fonctionnel',
  'Premium',
  'Classique',
  'Pratique',
  'Tendance'
] as const;

export const OCCASIONS = [
  'Quotidien',
  'Travail',
  'Soirée',
  'Sortie',
  'Prestige'
] as const;

export const CLOSURES = [
  'Fermeture éclair',
  'Bouton-pression',
  'Fermoir clip',
  'Ouvert avec bouton-pression'
] as const;
