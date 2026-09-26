'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useRegion } from '../contexts/RegionContext';
import { useSearchParams, useRouter } from 'next/navigation';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import ProductFiltersAmazon from '../components/ProductFiltersAmazon';
import { ProductService } from '../config/api';
import { useCart } from '../contexts/CartContext';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon,
  FunnelIcon,
  ShoppingBagIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

function buildCategoryTree(flat: any[]): any[] {
  const map = new Map<string, any>();
  flat.forEach(c => map.set(c.id, { ...c, subcategories: [] }));
  const roots: any[] = [];
  map.forEach(c => {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId).subcategories.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

const PAGE_SIZE = 24;

export default function BoutiquePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    }>
      <BoutiquePageInner />
    </Suspense>
  );
}

function BoutiquePageInner() {
  const { getActiveCategories, isHydrated } = useStore();
  const { formatPrice, t } = useRegion();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addItem } = useCart();

  // Server-side filter states (trigger API calls)
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Client-side filter states (applied to API results)
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(20000000);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState('all');

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // API data states
  const [apiProducts, setApiProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Categories from StoreContext (few records, no scalability concern)
  const flatCategories = isHydrated ? getActiveCategories() : [];
  const categories = buildCategoryTree(flatCategories);

  // Synchroniser les filtres avec l'URL, y compris lors d'une navigation
  // depuis l'en-tête alors que la page boutique est déjà montée.
  useEffect(() => {
    const search = searchParams?.get('search') || '';
    setSearchQuery(search);
    setDebouncedSearch(search);
    setCurrentPage(1);
  }, [searchParams]);

  const categorySlug = searchParams?.get('category') || '';
  useEffect(() => {
    if (!isHydrated) return;
    if (!categorySlug) {
      setSelectedCategory('all');
      return;
    }
    const matchingCategory = getActiveCategories().find((category) => category.slug === categorySlug);
    setSelectedCategory(matchingCategory?.id || 'all');
    setCurrentPage(1);
  }, [categorySlug, isHydrated, getActiveCategories]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch products from API whenever server-side filters change
  useEffect(() => {
    setLoadingProducts(true);
    ProductService.getPaginated({
      page:       currentPage,
      limit:      PAGE_SIZE,
      search:     debouncedSearch || undefined,
      categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
      sortBy,
    }).then(({ products, pagination: pag }) => {
      setApiProducts(products);
      setPagination(pag);
    }).finally(() => setLoadingProducts(false));
  }, [currentPage, debouncedSearch, selectedCategory, sortBy]);

  // Reset page when server filters change
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, selectedCategory, sortBy]);

  // Price stats from current API page
  const priceStats = useMemo(() => {
    if (apiProducts.length === 0) return { min: 0, max: 20000000 };
    const prices = apiProducts.map(p => p.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [apiProducts]);

  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (apiProducts.length > 0 && isFirstLoad.current) {
      setMinPrice(priceStats.min);
      setMaxPrice(priceStats.max);
      isFirstLoad.current = false;
    }
  }, [apiProducts.length]);

  // Available colors/materials/sellers from current API page
  const availableColors = useMemo(() => {
    const s = new Set<string>();
    apiProducts.forEach(p => Array.isArray(p.colors) && p.colors.forEach((c: string) => c && s.add(c)));
    return Array.from(s).sort();
  }, [apiProducts]);

  const availableMaterials = useMemo(() => {
    const s = new Set<string>();
    apiProducts.forEach(p => p.material && s.add(p.material));
    return Array.from(s).sort();
  }, [apiProducts]);

  const availableSellers = useMemo(() => {
    const seen = new Map<string, any>();
    apiProducts.forEach(p => {
      if (p.seller?.id && !seen.has(p.seller.id)) {
        seen.set(p.seller.id, { id: p.seller.id, storeName: p.seller.storeName, slug: p.seller.slug });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));
  }, [apiProducts]);

  // Client-side secondary filters applied to API page results
  const filteredProducts = useMemo(() => {
    return apiProducts.filter(p => {
      const priceMatch    = p.price >= minPrice && p.price <= maxPrice;
      const colorMatch    = selectedColors.length === 0 || (Array.isArray(p.colors) && p.colors.some((c: string) => selectedColors.includes(c)));
      const materialMatch = selectedMaterials.length === 0 || (p.material && selectedMaterials.includes(p.material));
      const sellerMatch   = selectedSellerId === 'all' || p.sellerId === selectedSellerId;
      return priceMatch && colorMatch && materialMatch && sellerMatch;
    });
  }, [apiProducts, minPrice, maxPrice, selectedColors, selectedMaterials, selectedSellerId]);

  const resetFilters = useCallback(() => {
    setSelectedCategory('all');
    setMinPrice(priceStats.min);
    setMaxPrice(priceStats.max);
    setSearchQuery('');
    setDebouncedSearch('');
    setSortBy('newest');
    setSelectedColors([]);
    setSelectedMaterials([]);
    setSelectedSellerId('all');
    setCurrentPage(1);
  }, [priceStats.min, priceStats.max]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    const tol = 100;
    if (Math.abs(minPrice - priceStats.min) > tol || Math.abs(maxPrice - priceStats.max) > tol) count++;
    if (debouncedSearch) count++;
    count += selectedColors.length + selectedMaterials.length;
    if (selectedSellerId !== 'all') count++;
    return count;
  }, [selectedCategory, minPrice, maxPrice, debouncedSearch, selectedColors, selectedMaterials, selectedSellerId, priceStats]);

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">MandeMarket</h2>
          <p className="text-gray-600">Chargement de la boutique...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <PublicHeader />

      {/* Hero Boutique */}
      <section className="relative text-white overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&h=600&fit=crop"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-brand-navy/75" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-16 md:py-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
              Découvrez tous nos produits
            </h1>
            <p className="text-lg text-white/85 mb-8">
              Des milliers de produits proposés par nos vendeurs.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDebouncedSearch(searchQuery);
                setCurrentPage(1);
              }}
              className="flex rounded-xl overflow-hidden bg-white shadow-xl max-w-xl"
            >
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                className="flex-1 px-5 py-3.5 text-brand-navy outline-none"
              />
              <button
                type="submit"
                className="px-5 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold transition"
                aria-label="Rechercher"
              >
                <MagnifyingGlassIcon className="w-6 h-6" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Barre de recherche et actions */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit (nom, description)..."
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setDebouncedSearch(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Effacer la recherche"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              )}
              {searchQuery !== debouncedSearch && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white font-medium min-w-[180px]"
              >
                <option value="newest">{t('shop.sort.newest')}</option>
                <option value="popular">{t('shop.sort.popular')}</option>
                <option value="price-low">{t('shop.sort.priceLow')}</option>
                <option value="price-high">{t('shop.sort.priceHigh')}</option>
                <option value="name">{t('shop.sort.name')}</option>
              </select>

              <div className="hidden md:flex bg-gray-100 rounded-xl p-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`} title="Vue grille">
                  <Squares2X2Icon className="w-5 h-5 text-gray-700" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`} title="Vue liste">
                  <ListBulletIcon className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="lg:hidden flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all font-semibold shadow-lg"
              >
                <FunnelIcon className="w-5 h-5" />
                Filtres
                {activeFiltersCount > 0 && (
                  <span className="bg-white text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">{activeFiltersCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* Filtres actifs (badges) */}
          {activeFiltersCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Filtres actifs:</span>
                {selectedCategory !== 'all' && (
                  <button onClick={() => setSelectedCategory('all')} className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold hover:bg-orange-200 transition-colors">
                    {flatCategories.find((c: any) => c.id === selectedCategory)?.name}
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
                {selectedColors.map(color => (
                  <button key={color} onClick={() => setSelectedColors(prev => prev.filter(c => c !== color))} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold hover:bg-blue-200 transition-colors">
                    {color} <XMarkIcon className="w-4 h-4" />
                  </button>
                ))}
                {selectedMaterials.map(material => (
                  <button key={material} onClick={() => setSelectedMaterials(prev => prev.filter(m => m !== material))} className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold hover:bg-purple-200 transition-colors">
                    {material} <XMarkIcon className="w-4 h-4" />
                  </button>
                ))}
                <button onClick={resetFilters} className="ml-auto text-sm text-gray-600 hover:text-gray-900 font-semibold underline">
                  Tout effacer
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar Filtres Desktop */}
          <aside className="hidden lg:block lg:w-80">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24 border border-gray-100">
              <ProductFiltersAmazon
                categories={categories}
                availableColors={availableColors}
                availableMaterials={availableMaterials}
                priceStats={priceStats}
                allProducts={apiProducts}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                minPrice={minPrice}
                setMinPrice={setMinPrice}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
                selectedColors={selectedColors}
                setSelectedColors={setSelectedColors}
                selectedMaterials={selectedMaterials}
                setSelectedMaterials={setSelectedMaterials}
                availableSellers={availableSellers}
                selectedSellerId={selectedSellerId}
                setSelectedSellerId={setSelectedSellerId}
                onReset={resetFilters}
                activeFiltersCount={activeFiltersCount}
                productsCount={filteredProducts.length}
              />
            </div>
          </aside>

          {/* Produits */}
          <main className="flex-1">

            {/* En-tête résultats */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  {loadingProducts ? '…' : `${pagination.total} ${pagination.total > 1 ? 'produits' : 'produit'}`}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedCategory === 'all' ? 'Toutes catégories' : flatCategories.find((c: any) => c.id === selectedCategory)?.name}
                  {pagination.totalPages > 1 && ` · Page ${currentPage}/${pagination.totalPages}`}
                </p>
              </div>
            </div>

            {/* Loader skeleton */}
            {loadingProducts ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse border border-gray-100">
                    <div className="aspect-square bg-gray-200" />
                    <div className="p-5 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-8 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-6'}>
                {filteredProducts.map(product => {
                  const category = flatCategories.find((c: any) => c.id === product.categoryId);
                  const isNew = new Date().getTime() - new Date(product.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;

                  if (viewMode === 'list') {
                    return (
                      <div key={product.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all border border-gray-100 group relative">
                        <Link href={`/boutique/${product.id}`} className="absolute inset-0 z-0" aria-label={`Voir ${product.name}`} />
                        <div className="flex flex-col md:flex-row">
                          <div className="md:w-64 h-64 overflow-hidden relative flex-shrink-0">
                            {isNew && (
                              <div className="absolute top-3 left-3 z-10">
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded-full text-xs font-bold shadow-lg">
                                  <SparklesIcon className="w-3 h-3" /> Nouveau
                                </span>
                              </div>
                            )}
                            <img
                              src={product.image || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop'}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop'; }}
                            />
                          </div>
                          <div className="flex-1 p-6">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">{category?.name}</span>
                              {product.seller?.slug && (
                                <Link href={`/vendeur/${product.seller.slug}`} onClick={e => e.stopPropagation()} className="text-xs text-gray-500 hover:text-orange-600">
                                  Vendu par {product.seller.storeName}
                                </Link>
                              )}
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">{product.name}</h3>
                            <p className="text-gray-600 mb-4">{product.description}</p>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {product.material && <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold">{product.material}</span>}
                              {Array.isArray(product.colors) && product.colors.slice(0, 3).map((color: string, idx: number) => color && (
                                <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">{color}</span>
                              ))}
                            </div>
                            <div className="flex gap-3 mt-auto relative z-10">
                              <div className="flex-1">
                                <div className="text-3xl font-bold text-gray-900">{formatPrice(product.price)}</div>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 ${
                                  (product.stock || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {(product.stock || 0) > 0 ? `${product.stock} en stock` : 'Rupture'}
                                </span>
                              </div>
                              <Link href={`/boutique/${product.id}`} onClick={e => e.stopPropagation()} className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-orange-500 hover:text-orange-600 transition-all font-bold inline-block text-center relative z-10">
                                Détails
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Grid view
                  return (
                    <article key={product.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 group border border-gray-100 relative block">
                      {isNew && (
                        <div className="absolute top-4 left-4 z-10">
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-full text-xs font-bold shadow-lg">
                            <SparklesIcon className="w-3 h-3" /> Nouveau
                          </span>
                        </div>
                      )}
                      <Link href={`/boutique/${product.id}`} className="relative block aspect-square overflow-hidden bg-gray-100">
                        <img
                          src={product.image || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&h=500&fit=crop'}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&h=500&fit=crop'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute bottom-4 left-4 right-4">
                            <span className="block w-full bg-white text-gray-900 py-2.5 px-4 rounded-lg font-bold text-center">Voir les détails</span>
                          </div>
                        </div>
                        <div className="absolute top-4 right-4">
                          <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                            (product.stock || 0) > 10 ? 'bg-green-500 text-white' :
                            (product.stock || 0) > 0  ? 'bg-yellow-500 text-white' :
                            'bg-gray-500 text-white'
                          }`}>
                            {(product.stock || 0) > 0 ? product.stock : 'Rupture'}
                          </span>
                        </div>
                      </Link>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">{category?.name}</span>
                          {product.seller?.slug && (
                            <span className="text-xs text-gray-500">· {product.seller.storeName}</span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">
                          <Link href={`/boutique/${product.id}`}>{product.name}</Link>
                        </h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                        {(product.material || (Array.isArray(product.colors) && product.colors.length > 0)) && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {product.material && <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold">{product.material}</span>}
                            {Array.isArray(product.colors) && product.colors.slice(0, 2).map((color: string, idx: number) => color && (
                              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">{color}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                          <div>
                            <div className="text-2xl font-bold text-gray-900">{formatPrice(product.price)}</div>
                            <div className="text-xs text-gray-500 font-medium">Prix TTC</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addItem(product, 1)}
                            className={`p-3 rounded-xl transition-all relative z-10 ${
                              (product.stock || 0) === 0
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl hover:scale-110'
                            }`}
                            disabled={(product.stock || 0) === 0}
                            title={(product.stock || 0) > 0 ? 'Ajouter au panier' : 'Indisponible'}
                            aria-label={(product.stock || 0) > 0 ? `Ajouter ${product.name} au panier` : `${product.name} indisponible`}
                          >
                            <ShoppingBagIcon className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-16 text-center">
                <div className="text-7xl mb-6">🔍</div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">Aucun produit trouvé</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">Aucun produit ne correspond à vos critères. Essayez de modifier vos filtres.</p>
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all font-bold shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <AdjustmentsHorizontalIcon className="w-5 h-5" />
                  Réinitialiser les filtres
                </button>
              </div>
            )}

            {/* Pagination */}
            {!loadingProducts && pagination.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Page précédente"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-gray-700" />
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p as number)}
                        className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                          currentPage === p
                            ? 'bg-orange-500 text-white shadow-lg'
                            : 'border border-gray-200 text-gray-700 hover:bg-orange-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Page suivante"
                >
                  <ChevronRightIcon className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modal filtres mobile */}
      {showMobileFilters && (
        <div className="fixed inset-0 bg-black/60 z-50 lg:hidden backdrop-blur-sm" onClick={() => setShowMobileFilters(false)}>
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-900">Filtres</h2>
                <button type="button" onClick={() => setShowMobileFilters(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors" aria-label="Fermer les filtres">
                  <XMarkIcon className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              <ProductFiltersAmazon
                categories={categories}
                availableColors={availableColors}
                availableMaterials={availableMaterials}
                priceStats={priceStats}
                allProducts={apiProducts}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                minPrice={minPrice}
                setMinPrice={setMinPrice}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
                selectedColors={selectedColors}
                setSelectedColors={setSelectedColors}
                selectedMaterials={selectedMaterials}
                setSelectedMaterials={setSelectedMaterials}
                availableSellers={availableSellers}
                selectedSellerId={selectedSellerId}
                setSelectedSellerId={setSelectedSellerId}
                onReset={resetFilters}
                activeFiltersCount={activeFiltersCount}
                productsCount={filteredProducts.length}
              />
              <button
                onClick={() => setShowMobileFilters(false)}
                className="w-full mt-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 px-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all font-bold shadow-lg"
              >
                Afficher les résultats ({filteredProducts.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
