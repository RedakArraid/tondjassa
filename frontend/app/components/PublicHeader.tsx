'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '../contexts/CartContext';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useRegion, ALL_COUNTRIES } from '../contexts/RegionContext';
import BrandLogo from './BrandLogo';
import {
  Bars3Icon,
  XMarkIcon,
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  UserCircleIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const AFRICA_CODES = ['CI', 'SN', 'ML', 'BF', 'TG', 'BJ', 'GN', 'GH', 'NG', 'CM', 'NE', 'MA'];
const EUROPE_CODES = ['FR', 'BE', 'CH', 'LU', 'DE', 'IT', 'ES', 'PT', 'NL', 'GB', 'AT', 'IE'];

export default function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const { customer, isAuthenticated } = useCustomerAuth();
  const { lang, setLang, countryCode, countryInfo, isDetecting, setCountry } = useRegion();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/boutique?search=${encodeURIComponent(searchValue.trim())}`);
      setSearchValue('');
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname?.startsWith(path);

  const navLinks = [
    { href: '/', label: 'Accueil' },
    { href: '/boutique', label: 'Boutique' },
    { href: '/bons-plans', label: 'Bons plans' },
    { href: '/a-propos', label: 'À propos' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top row */}
        <div className="flex items-center gap-4 h-16 md:h-[72px]">
          <BrandLogo size="md" />

          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-auto">
            <div className="relative w-full">
              <input
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Rechercher un produit, une marque..."
                className="w-full rounded-full bg-brand-cream border border-transparent focus:border-brand-orange focus:ring-2 focus:ring-orange-200 pl-5 pr-12 py-2.5 text-sm text-brand-navy placeholder:text-gray-400 outline-none transition"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-brand-orange"
                aria-label="Rechercher"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </button>
            </div>
          </form>

          <div className="hidden lg:flex items-center gap-1 ml-auto">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setCountryOpen(!countryOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-brand-soft text-sm"
              >
                {isDetecting ? (
                  <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>{countryInfo.flag}</span>
                )}
                <span className="font-medium text-gray-700 text-xs">{countryCode}</span>
                <ChevronDownIcon className={`w-3 h-3 text-gray-400 ${countryOpen ? 'rotate-180' : ''}`} />
              </button>
              {countryOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Afrique</p>
                    <div className="grid grid-cols-3 gap-1">
                      {AFRICA_CODES.map((code) => {
                        const c = ALL_COUNTRIES[code];
                        return (
                          <button
                            key={code}
                            onClick={() => {
                              setCountry(code);
                              setCountryOpen(false);
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs ${
                              countryCode === code
                                ? 'bg-orange-100 text-orange-700 font-semibold'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <span>{c.flag}</span>
                            <span>{code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="px-3 pt-2 pb-3 border-t border-gray-100 mt-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Europe</p>
                    <div className="grid grid-cols-3 gap-1">
                      {EUROPE_CODES.map((code) => {
                        const c = ALL_COUNTRIES[code];
                        return (
                          <button
                            key={code}
                            onClick={() => {
                              setCountry(code);
                              setCountryOpen(false);
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs ${
                              countryCode === code
                                ? 'bg-orange-100 text-orange-700 font-semibold'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <span>{c.flag}</span>
                            <span>{code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  lang === 'fr' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-500'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  lang === 'en' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-500'
                }`}
              >
                EN
              </button>
            </div>

            <Link
              href="/devenir-vendeur"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
            >
              <BuildingStorefrontIcon className="w-5 h-5" />
              Devenir vendeur
            </Link>

            {isAuthenticated ? (
              <Link
                href="/compte/dashboard"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-orange hover:bg-brand-soft rounded-lg"
              >
                <UserCircleIcon className="w-5 h-5" />
                {customer?.firstName}
              </Link>
            ) : (
              <Link
                href="/compte/login"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-navy hover:text-brand-orange"
              >
                <UserCircleIcon className="w-5 h-5" />
                Connexion
              </Link>
            )}

            <Link
              href="/panier"
              className="relative p-2 text-brand-navy hover:text-brand-orange transition-colors"
              aria-label="Panier"
            >
              <ShoppingBagIcon className="w-6 h-6" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 bg-brand-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden ml-auto p-2 rounded-lg text-brand-navy hover:bg-brand-soft"
            aria-label="Menu"
          >
            {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
          </button>
        </div>

        {/* Nav row desktop */}
        <nav className="hidden md:flex items-center gap-1 pb-3 -mt-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive(link.href)
                  ? 'text-brand-orange bg-brand-soft'
                  : 'text-brand-navy/80 hover:text-brand-orange hover:bg-brand-soft'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 py-4 space-y-3">
            <form onSubmit={handleSearch} className="px-1">
              <div className="relative">
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full rounded-full bg-brand-cream pl-4 pr-11 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-label="Rechercher"
                >
                  <MagnifyingGlassIcon className="w-5 h-5" />
                </button>
              </div>
            </form>
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg font-medium ${
                    isActive(link.href) ? 'bg-orange-100 text-brand-orange' : 'text-brand-navy hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/devenir-vendeur"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-brand-navy hover:bg-gray-50"
              >
                Devenir vendeur
              </Link>
              <Link
                href={isAuthenticated ? '/compte/dashboard' : '/compte/login'}
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-brand-navy hover:bg-gray-50"
              >
                {isAuthenticated ? `Mon compte (${customer?.firstName})` : 'Connexion'}
              </Link>
              <Link
                href="/panier"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-brand-navy hover:bg-gray-50"
              >
                Panier ({totalItems})
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
