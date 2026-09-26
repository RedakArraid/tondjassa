'use client';

import { apiFetch as fetch } from '../lib/api-fetch';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../contexts/CartContext';
import { useRegion } from '../contexts/RegionContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  UserIcon, MapPinIcon, CreditCardIcon, ShoppingBagIcon,
  LockClosedIcon, TruckIcon, CheckCircleIcon, ExclamationCircleIcon,
  GlobeAltIcon, PhoneIcon, TagIcon,
} from '@heroicons/react/24/outline';

type Region = 'africa' | 'europe';

interface ShippingOption {
  id: string;
  label: string;
  detail: string;
  carrier: string;
  costDisplay: string;
  costXof: number;
  eurCents?: number;
}

// ─── Pays ─────────────────────────────────────────────────────────────────────
const AFRICA_COUNTRIES = [
  { code: 'CI', name: "🇨🇮 Côte d'Ivoire" },
  { code: 'SN', name: '🇸🇳 Sénégal' },
  { code: 'ML', name: '🇲🇱 Mali' },
  { code: 'BF', name: '🇧🇫 Burkina Faso' },
  { code: 'TG', name: '🇹🇬 Togo' },
  { code: 'BJ', name: '🇧🇯 Bénin' },
  { code: 'GN', name: '🇬🇳 Guinée' },
  { code: 'GH', name: '🇬🇭 Ghana' },
  { code: 'NG', name: '🇳🇬 Nigeria' },
  { code: 'CM', name: '🇨🇲 Cameroun' },
  { code: 'NE', name: '🇳🇪 Niger' },
  { code: 'CD', name: '🇨🇩 RD Congo' },
  { code: 'MA', name: '🇲🇦 Maroc' },
  { code: 'MG', name: '🇲🇬 Madagascar' },
];

const EUROPE_COUNTRIES = [
  { code: 'FR', name: '🇫🇷 France' },
  { code: 'BE', name: '🇧🇪 Belgique' },
  { code: 'CH', name: '🇨🇭 Suisse' },
  { code: 'LU', name: '🇱🇺 Luxembourg' },
  { code: 'DE', name: '🇩🇪 Allemagne' },
  { code: 'IT', name: '🇮🇹 Italie' },
  { code: 'ES', name: '🇪🇸 Espagne' },
  { code: 'PT', name: '🇵🇹 Portugal' },
  { code: 'NL', name: '🇳🇱 Pays-Bas' },
  { code: 'GB', name: '🇬🇧 Royaume-Uni' },
  { code: 'AT', name: '🇦🇹 Autriche' },
  { code: 'IE', name: '🇮🇪 Irlande' },
];

const EUROPE_CODES = new Set(EUROPE_COUNTRIES.map(c => c.code));
const UEMOA_CODES = new Set(['SN', 'ML', 'BF', 'TG', 'BJ', 'GN']);

// ─── Côte d'Ivoire : communes et zones de livraison ───────────────────────────
const ABIDJAN_COMMUNES = [
  { name: 'Plateau',    zone: 1 },
  { name: 'Cocody',     zone: 1 },
  { name: 'Marcory',    zone: 1 },
  { name: 'Bingerville',zone: 1 },
  { name: 'Riviera',    zone: 1 },
  { name: 'Yopougon',   zone: 2 },
  { name: 'Abobo',      zone: 2 },
  { name: 'Adjamé',     zone: 2 },
  { name: 'Treichville',zone: 2 },
  { name: 'Koumassi',   zone: 2 },
  { name: 'Port-Bouët', zone: 2 },
  { name: 'Attécoubé',  zone: 2 },
];
// Shipping names and prices come exclusively from the server quote API.
const EUR_XOF = 655.957;
function xofToEur(centimesXof: number) {
  return Math.round((centimesXof / 100 / EUR_XOF) * 100) / 100;
}

const CI_OPERATORS = [
  {
    value: 'mtn_momo',
    label: 'MTN Mobile Money',
    badge: 'MTN',
    bg: 'bg-yellow-400',
    border: 'border-yellow-400',
    selectedBorder: 'border-yellow-500',
    selectedBg: 'bg-yellow-50',
    textBadge: 'text-yellow-900',
    textLabel: 'text-gray-800',
    hint: 'Numéro MTN commençant par 05',
  },
  {
    value: 'orange_money',
    label: 'Orange Money',
    badge: 'OM',
    bg: 'bg-orange-500',
    border: 'border-orange-300',
    selectedBorder: 'border-orange-500',
    selectedBg: 'bg-orange-50',
    textBadge: 'text-white',
    textLabel: 'text-gray-800',
    hint: 'Numéro Orange commençant par 07',
  },
  {
    value: 'wave',
    label: 'Wave',
    badge: 'W',
    bg: 'bg-blue-500',
    border: 'border-blue-300',
    selectedBorder: 'border-blue-500',
    selectedBg: 'bg-blue-50',
    textBadge: 'text-white',
    textLabel: 'text-gray-800',
    hint: 'Votre compte Wave CI',
  },
  {
    value: 'moov_money',
    label: 'Moov Money',
    badge: 'MM',
    bg: 'bg-indigo-600',
    border: 'border-indigo-300',
    selectedBorder: 'border-indigo-600',
    selectedBg: 'bg-indigo-50',
    textBadge: 'text-white',
    textLabel: 'text-gray-800',
    hint: 'Numéro Moov commençant par 01',
  },
];

const MOBILE_MONEY_VALUES = new Set(CI_OPERATORS.map(o => o.value));

const AFRICA_PAYMENT = [
  { value: 'paystack',          label: 'Mobile Money / Carte', description: 'MTN MoMo, Orange Money, Wave, Moov, Carte bancaire via Paystack', emoji: '📱' },
  { value: 'cash_on_delivery',  label: 'Paiement à la livraison', description: 'Payez en espèces à la réception de votre colis', emoji: '💵' },
];

const EUROPE_PAYMENT = [
  { value: 'stripe', label: 'Carte bancaire / SEPA', description: 'Visa, Mastercard, SEPA — Paiement sécurisé SSL via Stripe', emoji: '💳' },
];

// ─── Form ─────────────────────────────────────────────────────────────────────
interface CheckoutForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  commune: string;
  postalCode: string;
  countryCode: string;
  paymentMethod: string;
  shippingOptionId: string;
  notes: string;
}

const INITIAL: CheckoutForm = {
  firstName: '', lastName: '', email: '', phone: '',
  street: '', city: '', commune: '', postalCode: '',
  countryCode: 'CI', paymentMethod: 'mtn_momo', shippingOptionId: 'STANDARD', notes: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, totalItems, clearCart } = useCart();
  const { setCountry } = useRegion();
  const [form, setForm] = useState<CheckoutForm>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkoutCompleted = useRef(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [acceptedQuoteKey, setAcceptedQuoteKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Devis serveur autoritaire et promotions (MM-BE-031 / MM-FE-030)
  const [serverQuote, setServerQuote] = useState<{
    subtotalAmount: number;
    shippingCost: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    appliedPromotion: { code: string; name?: string; discountAmount: number } | null;
  } | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  useEffect(() => { setIsHydrated(true); }, []);
  useEffect(() => { if (isHydrated && items.length === 0 && !checkoutCompleted.current) router.push('/boutique'); }, [isHydrated, items.length, router]);
  useEffect(() => { setCountry(form.countryCode); }, [form.countryCode, setCountry]);

  const isCI = form.countryCode === 'CI';
  const region: Region = useMemo(() =>
    EUROPE_CODES.has(form.countryCode) ? 'europe' : 'africa',
  [form.countryCode]);

  const quoteKey = JSON.stringify({
    items: items.map(item => ({ productId: item.product.id, quantity: item.quantity })),
    country: form.countryCode,
    shippingMethod: form.shippingOptionId,
    promoCode: appliedPromo || undefined,
  });
  useEffect(() => {
    const controller = new AbortController();
    setShippingOptions([]);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002'}/api/checkout/shipping-options?country=${encodeURIComponent(form.countryCode)}&subtotal=${totalPrice}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Livraison indisponible'); return response.json(); })
      .then(data => {
        if (controller.signal.aborted) return;
        setShippingOptions(data.options.map((option: { code: string; name: string; cost: number }) => ({
          id: option.code, label: option.name, detail: 'Tarif calcule par le serveur', carrier: '', costXof: option.cost, costDisplay: '',
        })));
      })
      .catch(() => { if (!controller.signal.aborted) setShippingOptions([]); });
    return () => controller.abort();
  }, [form.countryCode, totalPrice]);

  useEffect(() => {
    if (items.length === 0) return;
    const controller = new AbortController();
    setIsQuoteLoading(true); setQuoteError(null); setServerQuote(null); setAcceptedQuoteKey('');
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002'}/api/checkout/quote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: quoteKey, signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok || typeof data.totalAmount !== 'number') throw new Error(data.error || 'Devis indisponible');
      return data;
    }).then(data => {
      if (controller.signal.aborted) return;
      setServerQuote(data); setAcceptedQuoteKey(quoteKey);
      if (data.appliedPromotion) setPromoMessage({ type: 'success', text: `Code promo ${data.appliedPromotion.code} applique` });
    }).catch(error => { if (!controller.signal.aborted) setQuoteError(error.message || 'Devis indisponible'); })
      .finally(() => { if (!controller.signal.aborted) setIsQuoteLoading(false); });
    return () => controller.abort();
  }, [quoteKey, items.length]);

  useEffect(() => {
    setForm(prev => ({ ...prev, shippingOptionId: 'STANDARD',
      paymentMethod: region === 'europe' ? 'stripe' : isCI ? 'mtn_momo' : 'paystack', commune: '',
    }));
  }, [region, isCI]);

  const selectedShipping = shippingOptions.find(o => o.id === form.shippingOptionId) ?? shippingOptions[0];
  const shippingCostXof = serverQuote ? serverQuote.shippingCost : (selectedShipping?.costXof ?? 0);
  const discountAmountXof = serverQuote ? serverQuote.discountAmount : 0;
  const totalWithShipping = serverQuote ? serverQuote.totalAmount : (totalPrice + shippingCostXof);

  const displayPrice = (centimesXof: number) => {
    if (region === 'europe') return `${xofToEur(centimesXof).toFixed(2).replace('.', ',')} €`;
    return `${Math.round(centimesXof / 100).toLocaleString('fr-FR')} FCFA`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validate = (): string | null => {
    if (!form.firstName.trim()) return 'Le prénom est requis.';
    if (!form.lastName.trim()) return 'Le nom est requis.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email invalide.';
    if (isCI && MOBILE_MONEY_VALUES.has(form.paymentMethod) && !form.phone.trim()) {
      return 'Le numéro de téléphone Mobile Money est requis.';
    }
    if (!form.street.trim()) return "L'adresse de livraison est requise.";
    if (!isCI && !form.city.trim()) return 'La ville est requise.';
    if (isCI && !form.commune) return 'Veuillez sélectionner votre commune ou ville.';
    if (isCI && form.commune === 'autre_ci' && !form.city.trim()) return 'Veuillez saisir le nom de votre ville.';
    if (region === 'europe' && !form.postalCode.trim()) return 'Le code postal est requis pour la livraison en Europe.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverQuote || acceptedQuoteKey !== quoteKey || isQuoteLoading || quoteError) {
      setError('Un devis valide est necessaire avant de confirmer.'); return;
    }
    const err = validate();
    if (err) { setError(err); return; }

    setIsSubmitting(true);
    setError(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';

    const countryName = [...AFRICA_COUNTRIES, ...EUROPE_COUNTRIES]
      .find(c => c.code === form.countryCode)?.name.replace(/^..\s/, '') ?? form.countryCode;

    const resolvedCity = isCI && form.commune && form.commune !== 'autre_ci'
      ? 'Abidjan'
      : form.city.trim();

    const gateway = MOBILE_MONEY_VALUES.has(form.paymentMethod)
      ? form.paymentMethod  // e.g. 'mtn_momo'
      : form.paymentMethod; // 'paystack' | 'stripe' | 'cash_on_delivery'

    const payload = {
      customer: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      },
      address: {
        street: [form.street.trim(), form.commune && form.commune !== 'autre_ci' ? form.commune : ''].filter(Boolean).join(', '),
        city: resolvedCity || 'Abidjan',
        postalCode: form.postalCode.trim() || '00000',
        country: form.countryCode,
      },
      items: items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.price,
      })),
      paymentMethod: gateway,
      shippingMethod: form.shippingOptionId,
      promoCode: appliedPromo || undefined,
      notes: form.notes.trim() || undefined,
    };

    const fingerprint = JSON.stringify(payload);
    let attempt: { fingerprint: string; key: string; secret: string } | null = null;
    try { attempt = JSON.parse(sessionStorage.getItem('mm_checkout_attempt') || 'null'); } catch { /* fresh attempt */ }
    if (!attempt || attempt.fingerprint !== fingerprint) {
      attempt = { fingerprint, key: crypto.randomUUID(), secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('') };
      sessionStorage.setItem('mm_checkout_attempt', JSON.stringify(attempt));
    }
    const securePayload = { ...payload, idempotencyKey: attempt.key, checkoutSecret: attempt.secret };
    try {
      const res = await fetch(`${API_URL}/api/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(securePayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? 'Erreur lors de la commande.');

      const orderId = data.orderId ?? data.id ?? data.order?.id;
      const orderRef = data.orderNumber || orderId;
      if (!orderId) throw new Error('Identifiant de commande non reçu.');
      sessionStorage.setItem(`mm_order_access_${orderId}`, attempt.secret);
      sessionStorage.setItem(`mm_order_access_${orderRef}`, attempt.secret);

      if (form.paymentMethod === 'cash_on_delivery') {
        sessionStorage.removeItem('mm_checkout_attempt');
        checkoutCompleted.current = true;
        clearCart();
        router.push(`/commande/${orderRef}`);
        return;
      }

      const payRes = await fetch(`${API_URL}/api/payment/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, gateway, returnBaseUrl: window.location.origin }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error ?? "Erreur d'initiation du paiement.");
      if (!payData.paymentUrl) throw new Error('URL de paiement non reçue.');

      if (payData.transactionId) sessionStorage.setItem(`mm_order_access_${payData.transactionId}`, attempt.secret);
      sessionStorage.removeItem('mm_checkout_attempt');
      checkoutCompleted.current = true;
      clearCart();
      window.location.href = payData.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  if (items.length === 0) return null;

  const selectedOperator = CI_OPERATORS.find(o => o.value === form.paymentMethod);
  const isMobileMoney = MOBILE_MONEY_VALUES.has(form.paymentMethod);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-orange-50/30">
      <PublicHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* En-tête */}
        <div className="mb-8 flex flex-wrap items-start gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">Finaliser la commande</h1>
            <p className="text-gray-600">
              {totalItems} {totalItems === 1 ? 'article' : 'articles'} &bull; Total :{' '}
              <span className="font-bold text-orange-600">{displayPrice(totalWithShipping)}</span>
            </p>
          </div>
          <div className={`ml-auto px-4 py-2 rounded-full text-sm font-semibold border flex items-center gap-2 ${
            region === 'europe'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : isCI
              ? 'bg-orange-50 border-orange-200 text-orange-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            <GlobeAltIcon className="w-4 h-4" />
            {region === 'europe' ? '🇪🇺 Livraison Europe' : isCI ? "🇨🇮 Livraison Côte d'Ivoire" : '🌍 Livraison Afrique'}
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
            <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Colonne gauche ── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Informations personnelles */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Informations personnelles</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { name: 'firstName', label: 'Prénom', placeholder: isCI ? 'Kouamé' : region === 'europe' ? 'Jean' : 'Oumar', required: true },
                    { name: 'lastName', label: 'Nom', placeholder: isCI ? 'Konaté' : region === 'europe' ? 'Dupont' : 'Diallo', required: true },
                    { name: 'email', label: 'Email', placeholder: 'email@exemple.com', required: true, type: 'email' },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={(f as any).type ?? 'text'}
                        name={f.name}
                        value={(form as any)[f.name]}
                        onChange={handleChange}
                        placeholder={f.placeholder}
                        required={f.required}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
                      />
                    </div>
                  ))}

                  {/* Téléphone — requis pour mobile money */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Téléphone {isMobileMoney && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder={isCI ? '+225 07 00 00 00 00' : region === 'europe' ? '+33 6 00 00 00 00' : '+221 77 000 00 00'}
                        required={isMobileMoney}
                        className={`w-full border-2 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none transition-colors ${
                          isMobileMoney ? 'border-orange-300 focus:border-orange-500' : 'border-gray-200 focus:border-orange-400'
                        }`}
                      />
                      {isMobileMoney && (
                        <PhoneIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                      )}
                    </div>
                    {isMobileMoney && selectedOperator && (
                      <p className="text-xs text-orange-600 mt-1 font-medium">
                        {selectedOperator.hint} — sera utilisé pour le paiement {selectedOperator.label}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Adresse de livraison */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <MapPinIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Adresse de livraison</h2>
                </div>

                <div className="space-y-4">
                  {/* Pays */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Pays <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="countryCode"
                      value={form.countryCode}
                      onChange={handleChange}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-orange-400 transition-colors bg-white"
                    >
                      <optgroup label="🌍 Afrique">
                        {AFRICA_COUNTRIES.map(c => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="🇪🇺 Europe">
                        {EUROPE_COUNTRIES.map(c => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* CI : sélecteur commune / zone */}
                  {isCI && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Commune / Ville <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="commune"
                        value={form.commune}
                        onChange={handleChange}
                        className="w-full border-2 border-orange-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-orange-500 transition-colors bg-white"
                      >
                        <option value="">— Sélectionner votre commune —</option>
                        <optgroup label="🟢 Abidjan Zone 1 — Gratuit • J+1">
                          {ABIDJAN_COMMUNES.filter(c => c.zone === 1).map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="🟡 Abidjan Zone 2 — 500 FCFA • J+2">
                          {ABIDJAN_COMMUNES.filter(c => c.zone === 2).map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="🔵 Autre ville CI — 2 000 FCFA • 3-5j">
                          <option value="autre_ci">Autre ville de Côte d'Ivoire</option>
                        </optgroup>
                      </select>
                    </div>
                  )}

                  {/* Ville (non-CI ou "autre ville CI") */}
                  {(!isCI || form.commune === 'autre_ci') && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Ville <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={form.city}
                        onChange={handleChange}
                        placeholder={isCI ? 'Bouaké, Yamoussoukro…' : region === 'europe' ? 'Paris' : 'Dakar'}
                        required
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
                      />
                    </div>
                  )}

                  {/* Rue / Quartier */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {region === 'europe' ? 'Adresse' : 'Rue / Quartier / Repère'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="street"
                      value={form.street}
                      onChange={handleChange}
                      placeholder={
                        isCI
                          ? 'Rue des Jardins, face à l\'école, Immeuble Kouassi…'
                          : region === 'europe'
                          ? '12 rue de la Paix, Bât. A'
                          : 'Quartier, rue, repère visible…'
                      }
                      required
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
                    />
                  </div>

                  {/* Code postal (Europe) */}
                  {region === 'europe' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Code postal <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="postalCode"
                          value={form.postalCode}
                          onChange={handleChange}
                          placeholder="75001"
                          required
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ville <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="city"
                          value={form.city}
                          onChange={handleChange}
                          placeholder="Paris"
                          required
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Options de livraison */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <TruckIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Mode de livraison</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isCI
                        ? "Livraison rapide en Côte d'Ivoire"
                        : region === 'europe'
                        ? "Livraison vers l'Europe — Colissimo / Chronopost"
                        : "Livraison Afrique de l'Ouest"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3" data-testid="shipping-options">
                  {shippingOptions.map(option => (
                    <label key={option.id} className="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer">
                      <input type="radio" name="shippingOptionId" value={option.id} checked={form.shippingOptionId === option.id} onChange={handleChange} />
                      <span className="flex-1 font-semibold">{option.label}</span>
                      <span className="font-bold">{displayPrice(option.costXof)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Méthode de paiement */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <CreditCardIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Méthode de paiement</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isCI ? 'Mobile Money CI — paiement sécurisé' : region === 'europe' ? 'Paiements sécurisés Europe' : 'Paiements Mobile Money Afrique'}
                    </p>
                  </div>
                </div>

                {/* Opérateurs CI */}
                {isCI ? (
                  <div className="space-y-4">
                    {/* Grille 2×2 opérateurs Mobile Money */}
                    <div className="grid grid-cols-2 gap-3">
                      {CI_OPERATORS.map(op => {
                        const isSelected = form.paymentMethod === op.value;
                        return (
                          <label
                            key={op.value}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected
                                ? `${op.selectedBorder} ${op.selectedBg}`
                                : 'border-gray-200 hover:border-orange-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={op.value}
                              checked={isSelected}
                              onChange={handleChange}
                              className="sr-only"
                            />
                            {/* Badge opérateur */}
                            <div className={`w-12 h-12 rounded-full ${op.bg} flex items-center justify-center font-bold text-sm ${op.textBadge} shadow-md`}>
                              {op.badge}
                            </div>
                            <span className={`text-sm font-semibold text-center ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                              {op.label}
                            </span>
                            {isSelected && <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                          </label>
                        );
                      })}
                    </div>

                    {/* Paiement à la livraison */}
                    <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      form.paymentMethod === 'cash_on_delivery'
                        ? 'border-gray-400 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash_on_delivery"
                        checked={form.paymentMethod === 'cash_on_delivery'}
                        onChange={handleChange}
                        className="accent-gray-600"
                      />
                      <span className="text-2xl">💵</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">Paiement à la livraison</p>
                        <p className="text-xs text-gray-500">Payez en espèces à la réception de votre colis</p>
                      </div>
                      {form.paymentMethod === 'cash_on_delivery' && <CheckCircleIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />}
                    </label>

                    {/* Info mobile money */}
                    {isMobileMoney && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                        📲 Votre numéro sera pré-rempli dans le formulaire de paiement sécurisé.
                        Vous pourrez valider via votre application ou composer le code USSD.
                      </div>
                    )}

                    {/* Contact WhatsApp */}
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <p className="text-xs text-orange-700">
                        Besoin d'aide ? Contactez-nous sur{' '}
                        <a
                          href="https://wa.me/2250700000000"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline"
                        >
                          WhatsApp
                        </a>{' '}
                        ou appelez le{' '}
                        <a href="tel:+2250700000000" className="font-bold">
                          +225 07 00 00 00 00
                        </a>
                      </p>
                    </div>
                  </div>
                ) : (
                  // Autres régions : affichage standard
                  <div className="space-y-3">
                    {(region === 'europe' ? EUROPE_PAYMENT : AFRICA_PAYMENT).map(method => {
                      const isSelected = form.paymentMethod === method.value;
                      return (
                        <label
                          key={method.value}
                          className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.value}
                            checked={isSelected}
                            onChange={handleChange}
                            className="mt-1 accent-orange-500"
                          />
                          <div className="flex-1">
                            <p className={`font-semibold flex items-center gap-2 ${isSelected ? 'text-orange-700' : 'text-gray-800'}`}>
                              <span>{method.emoji}</span>
                              {method.label}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">{method.description}</p>
                          </div>
                          {isSelected && <CheckCircleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />}
                        </label>
                      );
                    })}

                    {region === 'africa' && form.paymentMethod === 'paystack' && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                        📱 Vous serez redirigé vers Paystack pour choisir votre opérateur : <strong>MTN MoMo, Orange Money, Wave, Moov</strong> ou carte bancaire.
                      </div>
                    )}
                    {region === 'europe' && form.paymentMethod === 'stripe' && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                        💳 Paiement sécurisé via Stripe. Cartes Visa, Mastercard, American Express et virement SEPA acceptés. Montant débité en <strong>euros (€)</strong>.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Notes <span className="text-sm font-normal text-gray-400">(optionnel)</span>
                </h2>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder={
                    isCI
                      ? 'Repère pour la livraison, instructions particulières, heure préférée…'
                      : 'Instructions de livraison, informations complémentaires…'
                  }
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors resize-none"
                />
              </div>
            </div>

            {/* ── Colonne droite — Récapitulatif ── */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sticky top-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <ShoppingBagIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Votre commande</h2>
                </div>

                {/* Articles */}
                <div className="space-y-4 mb-6 max-h-72 overflow-y-auto pr-1">
                  {items.map((item, i) => (
                    <div key={`${item.product.id}-${i}`} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img
                          src={item.product.image ?? 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=100&h=100&fit=crop'}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                          onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=100&h=100&fit=crop'; }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.product.name}</p>
                        {item.selectedColor && <p className="text-xs text-gray-500">Couleur : {item.selectedColor}</p>}
                        <p className="text-xs text-gray-500">Qté : {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                        {displayPrice(item.product.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Code promo (MM-FE-030) */}
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Code Promo / Réduction
                  </label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-800">
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-4 h-4 text-green-600" />
                        <span className="font-bold">{appliedPromo}</span>
                        {discountAmountXof > 0 && (
                          <span className="text-xs bg-green-200 text-green-900 px-2 py-0.5 rounded-full font-semibold">
                            -{displayPrice(discountAmountXof)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedPromo(null);
                          setPromoMessage(null);
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold ml-2"
                      >
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: BIENVENUE10"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (promoInput.trim()) {
                            setAppliedPromo(promoInput.trim().toUpperCase());
                          }
                        }}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition"
                      >
                        Appliquer
                      </button>
                    </div>
                  )}
                  {promoMessage && (
                    <p className={`text-xs mt-1.5 ${promoMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {promoMessage.text}
                    </p>
                  )}
                </div>

                {/* Totaux */}
                <div className="border-t border-gray-200 pt-4 space-y-2">
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Sous-total</span>
                    <span className="font-semibold">{displayPrice(totalPrice)}</span>
                  </div>
                  {discountAmountXof > 0 && (
                    <div className="flex justify-between text-green-600 text-sm">
                      <span>Remise promo</span>
                      <span className="font-semibold">-{displayPrice(discountAmountXof)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Livraison</span>
                    <span className={`font-semibold ${shippingCostXof === 0 ? 'text-green-600' : ''}`}>
                      {shippingCostXof === 0 ? 'Gratuit' : displayPrice(shippingCostXof)}
                    </span>
                  </div>
                  {isCI && form.commune && form.commune !== 'autre_ci' && (
                    <p className="text-xs text-gray-400">
                      {selectedShipping?.label}
                    </p>
                  )}
                  {region === 'europe' && (
                    <p className="text-xs text-gray-400 italic">1 € = 655,96 FCFA (parité CFA)</p>
                  )}
                  <div className="border-t border-gray-200 pt-3 flex justify-between text-gray-900">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-lg font-bold text-orange-600">
                      {isQuoteLoading ? (
                        <span className="text-xs text-gray-400 font-normal">Calcul devis...</span>
                      ) : (
                        displayPrice(totalWithShipping)
                      )}
                    </span>
                  </div>
                </div>

                {quoteError && <p role="alert" className="mt-4 text-red-700">{quoteError}</p>}
                <output className="sr-only" data-testid="quote-total" data-amount={serverQuote?.totalAmount ?? ''}>{serverQuote ? displayPrice(serverQuote.totalAmount) : 'Devis en cours'}</output>
                {/* Bouton confirmer */}
                <button
                  type="submit"
                  disabled={isSubmitting || isQuoteLoading || !serverQuote || acceptedQuoteKey !== quoteKey || !!quoteError}
                  className="mt-6 w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-lg hover:from-orange-600 hover:to-orange-700 shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Traitement...</>
                  ) : (
                    <><CheckCircleIcon className="w-5 h-5" />Confirmer la commande</>
                  )}
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                  <LockClosedIcon className="w-4 h-4" />
                  <span>Paiement 100% sécurisé &bull; Données protégées</span>
                </div>

                <Link
                  href="/panier"
                  className="block w-full mt-3 text-center text-sm text-gray-500 hover:text-orange-600 transition-colors font-medium"
                >
                  Retour au panier
                </Link>
              </div>
            </div>
          </div>
        </form>
      </div>

      <PublicFooter />
    </div>
  );
}
