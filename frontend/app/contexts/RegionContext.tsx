'use client';

import { apiFetch as fetch } from '../lib/api-fetch';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const COUNTRY_KEY = 'mandemarket_country';
const LANG_KEY    = 'mandemarket_lang';

export type Lang = 'fr' | 'en';

export const ALL_COUNTRIES: Record<string, { name: string; flag: string; region: 'africa' | 'europe' }> = {
  CI: { name: "Côte d'Ivoire", flag: '🇨🇮', region: 'africa' },
  SN: { name: 'Sénégal',       flag: '🇸🇳', region: 'africa' },
  ML: { name: 'Mali',          flag: '🇲🇱', region: 'africa' },
  BF: { name: 'Burkina Faso',  flag: '🇧🇫', region: 'africa' },
  TG: { name: 'Togo',          flag: '🇹🇬', region: 'africa' },
  BJ: { name: 'Bénin',         flag: '🇧🇯', region: 'africa' },
  GN: { name: 'Guinée',        flag: '🇬🇳', region: 'africa' },
  GH: { name: 'Ghana',         flag: '🇬🇭', region: 'africa' },
  NG: { name: 'Nigeria',       flag: '🇳🇬', region: 'africa' },
  CM: { name: 'Cameroun',      flag: '🇨🇲', region: 'africa' },
  NE: { name: 'Niger',         flag: '🇳🇪', region: 'africa' },
  MA: { name: 'Maroc',         flag: '🇲🇦', region: 'africa' },
  FR: { name: 'France',        flag: '🇫🇷', region: 'europe' },
  BE: { name: 'Belgique',      flag: '🇧🇪', region: 'europe' },
  CH: { name: 'Suisse',        flag: '🇨🇭', region: 'europe' },
  LU: { name: 'Luxembourg',    flag: '🇱🇺', region: 'europe' },
  DE: { name: 'Allemagne',     flag: '🇩🇪', region: 'europe' },
  IT: { name: 'Italie',        flag: '🇮🇹', region: 'europe' },
  ES: { name: 'Espagne',       flag: '🇪🇸', region: 'europe' },
  PT: { name: 'Portugal',      flag: '🇵🇹', region: 'europe' },
  NL: { name: 'Pays-Bas',      flag: '🇳🇱', region: 'europe' },
  GB: { name: 'Royaume-Uni',   flag: '🇬🇧', region: 'europe' },
  AT: { name: 'Autriche',      flag: '🇦🇹', region: 'europe' },
  IE: { name: 'Irlande',       flag: '🇮🇪', region: 'europe' },
};

const DEFAULT_COUNTRY = 'CI';
// Taux fixe XOF/EUR depuis 1999
const EUR_RATE = 655.957;

// ─── Traductions ────────────────────────────────────────────────────────────
const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  fr: {
    'nav.home':    'Accueil',
    'nav.shop':    'Boutique',
    'nav.blog':    'Blog',
    'nav.contact': 'Contact',
    'nav.seller':  'Devenir vendeur',
    'nav.login':   'Connexion',
    'nav.account': 'Mon compte',
    'nav.cart':    'Panier',

    'shop.filters':         'Filtres',
    'shop.allCategories':   'Toutes catégories',
    'shop.sort.newest':     '✨ Nouveautés',
    'shop.sort.popular':    '🔥 Populaires',
    'shop.sort.priceLow':   '💰 Prix croissant',
    'shop.sort.priceHigh':  '💎 Prix décroissant',
    'shop.sort.name':       '🔤 Alphabétique',
    'shop.results.one':     'produit',
    'shop.results.many':    'produits',
    'shop.newBadge':        'Nouveau',
    'shop.addToCart':       'Ajouter au panier',
    'shop.buyNow':          'Acheter maintenant',
    'shop.unavailable':     'Indisponible',
    'shop.inStock':         'disponibles',
    'shop.outOfStock':      'Rupture de stock',

    'product.seller':              'Vendu par',
    'product.priceLabel':          'Prix TTC',
    'product.color':               'Couleur',
    'product.quantity':            'Quantité',
    'product.tab.description':     'Description',
    'product.tab.specs':           'Caractéristiques',
    'product.tab.reviews':         'Avis',
    'product.similar':             'Produits similaires',
    'product.guarantee.delivery':  'Livraison rapide',
    'product.guarantee.deliveryDesc': '48h à Abidjan',
    'product.guarantee.quality':   'Qualité garantie',
    'product.guarantee.qualityDesc': 'Produits authentiques',
    'product.guarantee.payment':   'Paiement sécurisé',
    'product.guarantee.paymentDesc': '100% sécurisé',
    'product.addedToCart':         'Produit ajouté au panier !',

    'auth.login':     'Se connecter',
    'auth.register':  "S'inscrire",
    'auth.noAccount': 'Pas encore de compte ?',
  },
  en: {
    'nav.home':    'Home',
    'nav.shop':    'Shop',
    'nav.blog':    'Blog',
    'nav.contact': 'Contact',
    'nav.seller':  'Become a seller',
    'nav.login':   'Login',
    'nav.account': 'My account',
    'nav.cart':    'Cart',

    'shop.filters':         'Filters',
    'shop.allCategories':   'All categories',
    'shop.sort.newest':     '✨ Newest',
    'shop.sort.popular':    '🔥 Popular',
    'shop.sort.priceLow':   '💰 Price: Low to High',
    'shop.sort.priceHigh':  '💎 Price: High to Low',
    'shop.sort.name':       '🔤 Alphabetical',
    'shop.results.one':     'product',
    'shop.results.many':    'products',
    'shop.newBadge':        'New',
    'shop.addToCart':       'Add to cart',
    'shop.buyNow':          'Buy now',
    'shop.unavailable':     'Unavailable',
    'shop.inStock':         'available',
    'shop.outOfStock':      'Out of stock',

    'product.seller':              'Sold by',
    'product.priceLabel':          'incl. tax',
    'product.color':               'Color',
    'product.quantity':            'Quantity',
    'product.tab.description':     'Description',
    'product.tab.specs':           'Specifications',
    'product.tab.reviews':         'Reviews',
    'product.similar':             'Similar products',
    'product.guarantee.delivery':  'Fast delivery',
    'product.guarantee.deliveryDesc': '48h in Abidjan',
    'product.guarantee.quality':   'Quality guaranteed',
    'product.guarantee.qualityDesc': 'Authentic products',
    'product.guarantee.payment':   'Secure payment',
    'product.guarantee.paymentDesc': '100% secure',
    'product.addedToCart':         'Product added to cart!',

    'auth.login':     'Sign in',
    'auth.register':  'Sign up',
    'auth.noAccount': 'No account yet?',
  },
};

// ─── Context type ────────────────────────────────────────────────────────────
interface RegionContextType {
  countryCode: string;
  countryInfo: { name: string; flag: string; region: 'africa' | 'europe' };
  isDetecting: boolean;
  lang: Lang;
  setLang:     (l: Lang) => void;
  setCountry:  (code: string) => void;
  formatPrice: (cents: number) => string;
  t:           (key: string) => string;
}

const DEFAULT_INFO = ALL_COUNTRIES[DEFAULT_COUNTRY];

const RegionContext = createContext<RegionContextType>({
  countryCode: DEFAULT_COUNTRY,
  countryInfo: DEFAULT_INFO,
  isDetecting: false,
  lang:        'fr',
  setLang:     () => {},
  setCountry:  () => {},
  formatPrice: (cents) => `${Math.round(cents / 100).toLocaleString('fr-FR')} FCFA`,
  t:           (key) => TRANSLATIONS.fr[key] ?? key,
});

// ─── Provider ────────────────────────────────────────────────────────────────
export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const [isDetecting, setIsDetecting] = useState(false);
  const [lang, setLangState]          = useState<Lang>('fr');

  useEffect(() => {
    // Langue
    const storedLang = localStorage.getItem(LANG_KEY) as Lang | null;
    if (storedLang === 'fr' || storedLang === 'en') setLangState(storedLang);

    // Pays : cache d'abord
    const cached = localStorage.getItem(COUNTRY_KEY);
    if (cached && ALL_COUNTRIES[cached]) {
      setCountryCode(cached);
      return;
    }

    // Détection IP
    setIsDetecting(true);
    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .then((data: { country_code?: string }) => {
        const code = data.country_code?.toUpperCase();
        if (code && ALL_COUNTRIES[code]) {
          setCountryCode(code);
          localStorage.setItem(COUNTRY_KEY, code);
        } else if (code) {
          const isEu = /^(AT|BE|BG|CY|CZ|DK|EE|FI|FR|DE|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE|GB|NO|CH|IS|LI|AL|BA|HR|ME|MK|RS|XK|AD|MC|SM)$/.test(code);
          const fallback = isEu ? 'FR' : 'CI';
          setCountryCode(fallback);
          localStorage.setItem(COUNTRY_KEY, fallback);
        }
      })
      .catch(() => {
        const navLang = navigator.language || '';
        const region  = navLang.split('-')[1]?.toUpperCase();
        if (region && ALL_COUNTRIES[region]) {
          setCountryCode(region);
          localStorage.setItem(COUNTRY_KEY, region);
        }
      })
      .finally(() => setIsDetecting(false));
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  };

  const setCountry = (code: string) => {
    if (code && ALL_COUNTRIES[code]) {
      setCountryCode(code);
      localStorage.setItem(COUNTRY_KEY, code);
    }
  };

  const countryInfo = ALL_COUNTRIES[countryCode] || DEFAULT_INFO;

  const formatPrice = useCallback((cents: number): string => {
    if (countryInfo.region === 'europe') {
      const eur = cents / 100 / EUR_RATE;
      return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
      }).format(eur);
    }
    return (
      new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(
        Math.round(cents / 100)
      ) + ' FCFA'
    );
  }, [countryInfo.region, lang]);

  const t = useCallback((key: string): string => {
    return TRANSLATIONS[lang][key] ?? TRANSLATIONS.fr[key] ?? key;
  }, [lang]);

  return (
    <RegionContext.Provider value={{
      countryCode,
      countryInfo,
      isDetecting,
      lang,
      setLang,
      setCountry,
      formatPrice,
      t,
    }}>
      {children}
    </RegionContext.Provider>
  );
}

export const useRegion = () => useContext(RegionContext);
