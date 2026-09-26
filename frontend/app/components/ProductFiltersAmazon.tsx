'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: Category[];
  productCount?: number;
}

interface ProductFiltersAmazonProps {
  // Données
  categories: Category[];
  availableColors: string[];
  availableMaterials: string[];
  priceStats: { min: number; max: number };
  allProducts: any[];
  
  // États
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  minPrice: number;
  setMinPrice: (price: number) => void;
  maxPrice: number;
  setMaxPrice: (price: number) => void;
  selectedColors: string[];
  setSelectedColors: (colors: string[]) => void;
  selectedMaterials: string[];
  setSelectedMaterials: (materials: string[]) => void;
  availableSellers?: { id: string; storeName: string; slug: string }[];
  selectedSellerId?: string;
  setSelectedSellerId?: (id: string) => void;
  
  // Actions
  onReset: () => void;
  activeFiltersCount: number;
  productsCount: number;
}

export default function ProductFiltersAmazon({
  categories,
  availableColors,
  availableMaterials,
  priceStats,
  allProducts,
  selectedCategory,
  setSelectedCategory,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  selectedColors,
  setSelectedColors,
  selectedMaterials,
  setSelectedMaterials,
  availableSellers = [],
  selectedSellerId = 'all',
  setSelectedSellerId,
  onReset,
  activeFiltersCount,
  productsCount
}: ProductFiltersAmazonProps) {

  const [expandedSections, setExpandedSections] = useState<string[]>(
    availableSellers.length > 0 ? ['categories', 'price', 'sellers'] : ['categories', 'price']
  );
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors(
      selectedColors.includes(color) 
        ? selectedColors.filter(c => c !== color) 
        : [...selectedColors, color]
    );
  };

  const toggleMaterial = (material: string) => {
    setSelectedMaterials(
      selectedMaterials.includes(material) 
        ? selectedMaterials.filter(m => m !== material) 
        : [...selectedMaterials, material]
    );
  };

  const handleMinPriceChange = (value: number) => {
    const newMin = Math.min(value, maxPrice - 100);
    setMinPrice(Math.max(priceStats.min, newMin));
  };

  const handleMaxPriceChange = (value: number) => {
    const newMax = Math.max(value, minPrice + 100);
    setMaxPrice(Math.min(priceStats.max, newMax));
  };

  // Les prix de l'API sont exprimés en centimes de FCFA.
  const presetPriceRanges = [
    { min: 0, max: 2_500_000 },
    { min: 2_500_000, max: 5_000_000 },
    { min: 5_000_000, max: 10_000_000 },
    { min: 10_000_000, max: priceStats.max },
  ]
    .filter((range) => range.min < priceStats.max)
    .map((range) => ({ ...range, max: Math.min(range.max, priceStats.max) }));

  return (
    <div className="space-y-1">
      
      {/* Header avec reset */}
      {activeFiltersCount > 0 && (
        <div className="pb-3 mb-3 border-b border-gray-200">
          <button
            onClick={onReset}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            Effacer tous les filtres ({activeFiltersCount})
          </button>
        </div>
      )}

      {/* Section Catégories - Style Amazon */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => toggleSection('categories')}
          className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-bold text-sm text-gray-900 uppercase">Catégories</span>
          {expandedSections.includes('categories') ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-600" />
          )}
        </button>
        
        {expandedSections.includes('categories') && (
          <div className="pb-3">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`block w-full text-left px-2 py-1.5 text-sm transition-colors ${
                selectedCategory === 'all'
                  ? 'text-orange-600 font-bold'
                  : 'text-gray-700 hover:text-orange-600'
              }`}
            >
              Tous les produits
              <span className="text-gray-500 text-xs ml-1">({productsCount})</span>
            </button>
            
            {categories.map(category => (
              <CategoryNode
                key={category.id}
                category={category}
                level={0}
                expanded={expandedCategories.includes(category.id)}
                selected={selectedCategory === category.id}
                onToggle={toggleCategory}
                onSelect={setSelectedCategory}
                allProducts={allProducts}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section Boutiques */}
      {availableSellers.length > 0 && setSelectedSellerId && (
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('sellers')}
            className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-bold text-sm text-gray-900 uppercase">Boutiques</span>
            {expandedSections.includes('sellers') ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
          {expandedSections.includes('sellers') && (
            <div className="pb-3 space-y-1">
              <button
                onClick={() => setSelectedSellerId('all')}
                className={`block w-full text-left px-2 py-1.5 text-sm transition-colors ${
                  selectedSellerId === 'all' ? 'text-brand-orange font-bold' : 'text-gray-700 hover:text-brand-orange'
                }`}
              >
                Toutes les boutiques
              </button>
              {availableSellers.map(s => (
                s.slug ? (
                  <Link
                    key={s.id}
                    href={`/vendeur/${s.slug}`}
                    className={`block w-full text-left px-2 py-1.5 text-sm transition-colors ${
                      selectedSellerId === s.id ? 'text-brand-orange font-bold' : 'text-gray-700 hover:text-brand-orange'
                    }`}
                  >
                    {s.storeName}
                  </Link>
                ) : (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSellerId(s.id)}
                    className={`block w-full text-left px-2 py-1.5 text-sm transition-colors ${
                      selectedSellerId === s.id ? 'text-brand-orange font-bold' : 'text-gray-700 hover:text-brand-orange'
                    }`}
                  >
                    {s.storeName}
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section Prix - Style Amazon */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => toggleSection('price')}
          className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-bold text-sm text-gray-900 uppercase">Prix</span>
          {expandedSections.includes('price') ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-600" />
          )}
        </button>
        
        {expandedSections.includes('price') && (
          <div className="pb-3 space-y-3">
            {/* Fourchettes de prix prédéfinies */}
            <div className="space-y-1">
              {presetPriceRanges.map((range, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setMinPrice(range.min);
                    setMaxPrice(range.max);
                  }}
                  className={`block w-full text-left px-2 py-1.5 text-sm transition-colors ${
                    minPrice === range.min && maxPrice === range.max
                      ? 'text-orange-600 font-semibold'
                      : 'text-gray-700 hover:text-orange-600'
                  }`}
                >
                  {Math.round(range.min / 100).toLocaleString()} - {Math.round(range.max / 100).toLocaleString()} F
                </button>
              ))}
            </div>
            
            {/* Inputs personnalisés */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  value={Math.round(minPrice / 100)}
                  onChange={(e) => handleMinPriceChange(Number(e.target.value) * 100)}
                  placeholder="Min"
                  className="min-w-0 flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
                <span className="text-gray-500">à</span>
                <input
                  type="number"
                  value={Math.round(maxPrice / 100)}
                  onChange={(e) => handleMaxPriceChange(Number(e.target.value) * 100)}
                  placeholder="Max"
                  className="min-w-0 flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-500">Le filtre s’applique automatiquement.</p>
            </div>
          </div>
        )}
      </div>

      {/* Section Couleurs */}
      {availableColors.length > 0 && (
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('colors')}
            className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-bold text-sm text-gray-900 uppercase">Couleur</span>
            {expandedSections.includes('colors') ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
          
          {expandedSections.includes('colors') && (
            <div className="pb-3 space-y-1">
              {availableColors.map(color => (
                <label key={color} className="flex items-center px-2 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedColors.includes(color)}
                    onChange={() => toggleColor(color)}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className={`ml-2 text-sm ${selectedColors.includes(color) ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {color}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section Matériaux */}
      {availableMaterials.length > 0 && (
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('materials')}
            className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-bold text-sm text-gray-900 uppercase">Matériau</span>
            {expandedSections.includes('materials') ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
          
          {expandedSections.includes('materials') && (
            <div className="pb-3 space-y-1">
              {availableMaterials.map(material => (
                <label key={material} className="flex items-center px-2 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedMaterials.includes(material)}
                    onChange={() => toggleMaterial(material)}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className={`ml-2 text-sm ${selectedMaterials.includes(material) ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {material}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Composant récursif pour afficher les catégories et sous-catégories
function CategoryNode({ 
  category, 
  level, 
  expanded, 
  selected, 
  onToggle, 
  onSelect,
  allProducts 
}: {
  category: Category;
  level: number;
  expanded: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  allProducts: any[];
}) {
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;
  const productCount = allProducts.filter(p => p.categoryId === category.id && p.status === 'active').length;

  return (
    <div>
      <div 
        className={`flex items-center py-1.5 hover:bg-gray-50 cursor-pointer transition-colors ${level > 0 ? 'pl-4' : 'px-2'}`}
        onClick={() => hasSubcategories ? onToggle(category.id) : onSelect(category.id)}
      >
        {hasSubcategories && (
          <span className="mr-1">
            {expanded ? (
              <ChevronDownIcon className="w-3 h-3 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-3 h-3 text-gray-600" />
            )}
          </span>
        )}
        <span className={`text-sm ${selected ? 'font-bold text-orange-600' : 'text-gray-700 hover:text-orange-600'} ${!hasSubcategories && level > 0 ? 'ml-4' : ''}`}>
          {category.name}
        </span>
        {productCount > 0 && (
          <span className="ml-auto text-xs text-gray-500">({productCount})</span>
        )}
      </div>
      
      {/* Sous-catégories */}
      {hasSubcategories && expanded && (
        <div>
          {category.subcategories!.map(sub => (
            <CategoryNode
              key={sub.id}
              category={sub}
              level={level + 1}
              expanded={expanded}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
              allProducts={allProducts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
