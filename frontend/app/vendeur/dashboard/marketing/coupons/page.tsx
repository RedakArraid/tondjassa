'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SellerPageHeader,
  SellerActionButton,
  SellerCard,
  SellerHeaderActions,
  RowActions,
  FilterChips,
} from '../../_components/ui';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';

export type CouponTypeId =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'FREE_SHIPPING'
  | 'PRODUCT_PERCENTAGE'
  | 'CATEGORY_PERCENTAGE'
  | 'BUY_X_GET_Y'
  | 'FIRST_ORDER'
  | 'SUBSCRIBERS';

type CouponStatus = 'active' | 'inactive';

type Coupon = {
  id: string;
  code: string;
  type: CouponTypeId;
  value: number;
  buyQty?: number;
  getQty?: number;
  productIds?: string;
  categoryName?: string;
  minAmount: number;
  maxUses: number;
  startDate: string;
  endDate: string;
  status: CouponStatus;
  uses: number;
};

const COUPON_TYPES: {
  id: CouponTypeId;
  label: string;
  example: string;
  description: string;
  defaultCode: string;
}[] = [
  { id: 'PERCENTAGE', label: 'Réduction en %', example: 'PROMO20 → -20 %',
    description: 'Réduction financée par votre boutique, appliquée uniquement à vos articles.', defaultCode: 'PROMO20' },
  { id: 'FIXED_AMOUNT', label: 'Montant fixe', example: 'CADEAU5000 → -5 000 FCFA',
    description: 'Montant financé par votre boutique, appliqué uniquement à vos articles.', defaultCode: 'CADEAU5000' },
];

function typeMeta(id: CouponTypeId) {
  return COUPON_TYPES.find((t) => t.id === id) || COUPON_TYPES[0];
}

function formatEffect(c: Coupon) {
  switch (c.type) {
    case 'PERCENTAGE':
    case 'PRODUCT_PERCENTAGE':
    case 'CATEGORY_PERCENTAGE':
    case 'FIRST_ORDER':
    case 'SUBSCRIBERS':
      return `-${c.value} %`;
    case 'FIXED_AMOUNT':
      return `-${c.value.toLocaleString('fr-FR')} FCFA`;
    case 'FREE_SHIPPING':
      return 'Livraison offerte';
    case 'BUY_X_GET_Y':
      return `${c.buyQty || 2}+${c.getQty || 1}`;
    default:
      return '—';
  }
}

function emptyForm(type: CouponTypeId = 'PERCENTAGE') {
  const meta = typeMeta(type);
  return {
    code: meta.defaultCode,
    type,
    value: type === 'FIXED_AMOUNT' ? 5000 : type === 'FREE_SHIPPING' ? 0 : type === 'BUY_X_GET_Y' ? 0 : 20,
    buyQty: 2,
    getQty: 1,
    productIds: '',
    categoryName: '',
    minAmount: 0,
    maxUses: 100,
    startDate: '',
    endDate: '',
  };
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('Tous');
  const [form, setForm] = useState(emptyForm());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const list = await SellerService.getMyPromotions();
      if (Array.isArray(list)) {
        setCoupons(
          list.map((p: any) => ({
            id: p.id,
            code: p.code,
            type: (p.type as CouponTypeId) || 'PERCENTAGE',
            value: p.type === 'FIXED_AMOUNT' ? Math.round((p.value || 0) / 100) : p.value,
            minAmount: Math.round((p.minAmount || 0) / 100),
            maxUses: p.maxUses || 100,
            startDate: p.startDate ? p.startDate.slice(0, 10) : '',
            endDate: p.endDate ? p.endDate.slice(0, 10) : '',
            status: p.isActive ? 'active' : 'inactive',
            uses: p.usedCount || 0,
          }))
        );
      }
    } catch (err: any) {
      console.error('Erreur chargement promotions:', err);
      setFeedback({ type: 'error', message: 'Erreur lors du chargement des promotions.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'Tous') return coupons;
    if (filter === 'Actifs') return coupons.filter((c) => c.status === 'active');
    if (filter === 'Inactifs') return coupons.filter((c) => c.status === 'inactive');
    const match = COUPON_TYPES.find((t) => t.label === filter);
    return match ? coupons.filter((c) => c.type === match.id) : coupons;
  }, [coupons, filter]);

  const openCreate = (type?: CouponTypeId) => {
    setEditingId(null);
    setForm(emptyForm(type || 'PERCENTAGE'));
    setShow(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      buyQty: c.buyQty || 2,
      getQty: c.getQty || 1,
      productIds: c.productIds || '',
      categoryName: c.categoryName || '',
      minAmount: c.minAmount,
      maxUses: c.maxUses,
      startDate: c.startDate,
      endDate: c.endDate,
    });
    setShow(true);
  };

  const generateCode = () => {
    const meta = typeMeta(form.type);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    setForm((f) => ({ ...f, code: `${meta.defaultCode}${suffix}`.slice(0, 16) }));
  };

  const onTypeChange = (type: CouponTypeId) => {
    const meta = typeMeta(type);
    setForm((f) => ({
      ...emptyForm(type),
      code: f.code || meta.defaultCode,
      minAmount: f.minAmount,
      maxUses: f.maxUses,
      startDate: f.startDate,
      endDate: f.endDate,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      alert('Le code est obligatoire');
      return;
    }
    if (form.type !== 'FREE_SHIPPING' && form.type !== 'BUY_X_GET_Y' && form.value <= 0) {
      alert('Indiquez une valeur de réduction');
      return;
    }
    if (form.type === 'PRODUCT_PERCENTAGE' && !form.productIds.trim()) {
      alert('Indiquez le(s) produit(s) concerné(s)');
      return;
    }
    if (form.type === 'CATEGORY_PERCENTAGE' && !form.categoryName.trim()) {
      alert('Indiquez la catégorie');
      return;
    }

    try {
      await SellerService.createPromotion({
        code: form.code.trim().toUpperCase(),
        name: `Promotion ${form.code}`,
        type: form.type === 'FREE_SHIPPING' ? 'FREE_SHIPPING' : (form.type === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE'),
        value: Number(form.value) || 0,
        minAmount: form.minAmount ? Number(form.minAmount) : undefined,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      setFeedback({ type: 'success', message: `Code promo ${form.code.toUpperCase()} activé avec succès.` });
      setShow(false);
      setEditingId(null);
      await loadPromotions();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la création de la promotion');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Désactiver ce coupon ?')) return;
    try {
      await SellerService.deletePromotion(id);
      setFeedback({ type: 'success', message: 'Coupon désactivé avec succès.' });
      await loadPromotions();
    } catch (err: any) {
      alert('Erreur lors de la désactivation');
    }
  };

  const duplicate = async (c: Coupon) => {
    let copyIndex = 1;
    let copyCode = `${c.code.slice(0, 12)}-${copyIndex}`;
    while (coupons.some((coupon) => coupon.code === copyCode)) {
      copyIndex += 1;
      copyCode = `${c.code.slice(0, 12)}-${copyIndex}`;
    }
    try {
      await SellerService.createPromotion({
        code: copyCode,
        name: `Copie de ${c.code}`,
        type: c.type === 'FREE_SHIPPING' ? 'FREE_SHIPPING' : (c.type === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE'),
        value: c.value,
        minAmount: c.minAmount,
        maxUses: c.maxUses,
      });
      setFeedback({ type: 'success', message: `Copie créée avec le code ${copyCode}.` });
      await loadPromotions();
    } catch (err: any) {
      alert('Erreur lors de la duplication');
    }
  };

  const needsValue =
    form.type !== 'FREE_SHIPPING' && form.type !== 'BUY_X_GET_Y';
  const valueLabel =
    form.type === 'FIXED_AMOUNT' ? 'Montant (FCFA)' : 'Pourcentage (%)';

  return (
    <div className="space-y-4">
      <SellerPageHeader
        title="Coupons"
        description="Créez des réductions financées par votre boutique, limitées à vos propres articles."
        action={
          <SellerActionButton variant="primary" onClick={() => openCreate()}>
            + Créer un coupon
          </SellerActionButton>
        }
      />

      <SellerCard title="Types de coupons">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {COUPON_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openCreate(t.id)}
              className="text-left rounded-xl border border-gray-100 bg-brand-cream/40 hover:border-brand-orange hover:bg-brand-soft p-4 transition"
            >
              <p className="font-semibold text-brand-navy text-sm">{t.label}</p>
              <p className="text-xs font-mono text-brand-orange mt-1">{t.example}</p>
              <p className="text-xs text-gray-500 mt-2">{t.description}</p>
            </button>
          ))}
        </div>
      </SellerCard>

      {show && (
        <SellerCard
          title={editingId ? 'Modifier le coupon' : 'Nouveau coupon'}
          action={
            <SellerActionButton size="sm" variant="ghost" onClick={() => setShow(false)}>
              Fermer
            </SellerActionButton>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Type</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {COUPON_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTypeChange(t.id)}
                    className={`text-left rounded-lg border px-3 py-2 text-xs transition ${
                      form.type === t.id
                        ? 'border-brand-orange bg-brand-soft text-brand-navy'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-brand-orange'
                    }`}
                  >
                    <span className="font-semibold block">{t.label}</span>
                    <span className="text-[11px] text-gray-500">{t.example}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">{typeMeta(form.type).description}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
              <div>
                <label className="text-xs font-semibold text-gray-500">Code</label>
                <div className="flex gap-2 mt-1">
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                    placeholder="CODEPROMO"
                  />
                  <SellerActionButton type="button" variant="outline" onClick={generateCode}>
                    Générer
                  </SellerActionButton>
                </div>
              </div>

              {needsValue && (
                <div>
                  <label className="text-xs font-semibold text-gray-500">{valueLabel}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) || 0 }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              )}

              {form.type === 'BUY_X_GET_Y' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Achetez (X)</label>
                    <input
                      type="number"
                      min={1}
                      value={form.buyQty}
                      onChange={(e) => setForm((f) => ({ ...f, buyQty: Number(e.target.value) || 1 }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Obtenez (Y offert)</label>
                    <input
                      type="number"
                      min={1}
                      value={form.getQty}
                      onChange={(e) => setForm((f) => ({ ...f, getQty: Number(e.target.value) || 1 }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </>
              )}

              {form.type === 'PRODUCT_PERCENTAGE' && (
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-gray-500">Produits concernés</label>
                  <input
                    required
                    value={form.productIds}
                    onChange={(e) => setForm((f) => ({ ...f, productIds: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Ex: Sac cuir, Sac voyage…"
                  />
                </div>
              )}

              {form.type === 'CATEGORY_PERCENTAGE' && (
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-gray-500">Catégorie</label>
                  <input
                    required
                    value={form.categoryName}
                    onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Ex: Mode, High-Tech…"
                  />
                </div>
              )}

              {(form.type === 'FIRST_ORDER' || form.type === 'SUBSCRIBERS') && (
                <div className="md:col-span-2 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand-navy">
                  {form.type === 'FIRST_ORDER'
                    ? 'Ce coupon ne s’appliquera qu’à la première commande du client.'
                    : 'Ce coupon est réservé aux abonnés / followers de votre boutique.'}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500">Commande minimum (FCFA)</label>
                <input
                  type="number"
                  min={0}
                  value={form.minAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minAmount: Number(e.target.value) || 0 }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Nombre d’utilisations</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxUses}
                  onChange={(e) => setForm((f) => ({ ...f, maxUses: Number(e.target.value) || 1 }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Date début</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Date fin</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>

            <SellerHeaderActions>
              <SellerActionButton type="button" variant="outline" onClick={generateCode}>
                Générer un code
              </SellerActionButton>
              <SellerActionButton type="submit" variant="primary">
                {editingId ? 'Enregistrer' : 'Créer le coupon'}
              </SellerActionButton>
              <SellerActionButton type="button" variant="secondary" onClick={() => setShow(false)}>
                Annuler
              </SellerActionButton>
            </SellerHeaderActions>
          </form>
        </SellerCard>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <FilterChips
          options={['Tous', 'Actifs', 'Inactifs', ...COUPON_TYPES.map((t) => t.label)]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <SellerCard title="Coupons existants">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun coupon pour ce filtre.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const meta = typeMeta(c.type);
              return (
                <div
                  key={c.id}
                  className="border border-gray-100 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-brand-navy font-mono">{c.code}</p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          c.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.status === 'active' ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {meta.label} · {formatEffect(c)} · {c.uses}/{c.maxUses} utilisations
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Ex. {meta.example}
                      {c.productIds ? ` · Produits : ${c.productIds}` : ''}
                      {c.categoryName ? ` · Catégorie : ${c.categoryName}` : ''}
                    </p>
                  </div>
                  <RowActions>
                    <SellerActionButton size="sm" variant="outline" onClick={() => duplicate(c)}>
                      Dupliquer
                    </SellerActionButton>
                    <SellerActionButton size="sm" variant="danger" onClick={() => remove(c.id)}>
                      Désactiver
                    </SellerActionButton>
                  </RowActions>
                </div>
              );
            })}
          </div>
        )}
      </SellerCard>
    </div>
  );
}
