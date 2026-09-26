'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CategoryService, ProductService } from '../../../../config/api';
import CloudinaryImageUpload from '../../../../components/CloudinaryImageUpload';
import { Spinner } from '../../_components/sections';
import {
  SellerPageHeader,
  SellerHeaderActions,
  SellerActionButton,
  SellerCard,
} from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

const STEPS = ['Informations', 'Images & Galerie', 'Prix', 'Stock & Variantes', 'Logistique'];

function ProductFormContent() {
  const { can } = useSellerAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('id');

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    subCategory: '',
    description: '',
    brand: '',
    condition: 'new',
    image: '',
    images: [] as string[],
    price: '',
    promoPrice: '',
    stock: '10',
    sku: '',
    variants: '',
    weight: '',
    dimensions: '',
    prepDelay: '',
    status: 'active',
  });

  useEffect(() => {
    Promise.allSettled([
      CategoryService.getAll(),
      editId ? ProductService.getById(editId) : Promise.resolve(null),
    ]).then(([catRes, prodRes]) => {
      if (catRes.status === 'fulfilled') {
        const cList = catRes.value;
        setCategories(Array.isArray(cList) ? cList.filter((x: any) => x.status !== 'inactive') : []);
      }
      if (prodRes.status === 'fulfilled' && prodRes.value) {
        const p = prodRes.value;
        setForm({
          name: p.name || '',
          categoryId: p.categoryId || '',
          subCategory: '',
          description: p.description || '',
          brand: p.brand || '',
          condition: p.condition || 'new',
          image: p.image || '',
          images: Array.isArray(p.images) ? p.images : [],
          price: p.price ? String(p.price / 100) : '',
          promoPrice: '',
          stock: String(p.stock ?? 10),
          sku: p.sku || '',
          variants: Array.isArray(p.features) ? p.features.join(', ') : '',
          weight: p.weight ? String(p.weight) : '',
          dimensions: p.dimensions || '',
          prepDelay: '',
          status: p.status || 'active',
        });
      }
      setLoading(false);
    });
  }, [editId]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const addGalleryImage = (url: string) => {
    if (url && !form.images.includes(url)) {
      setForm((f) => ({ ...f, images: [...f.images, url] }));
    }
  };

  const removeGalleryImage = (index: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  };

  const save = async (asDraft: boolean) => {
    setError('');
    if (!form.name || !form.categoryId) {
      setError('Veuillez renseigner au minimum le nom et la catégorie du produit.');
      setStep(0);
      return;
    }

    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(form.promoPrice || form.price || '0') * 100);
      const payload = {
        name: form.name.trim(),
        categoryId: form.categoryId,
        description: form.description.trim() || form.name.trim(),
        brand: form.brand || undefined,
        condition: form.condition || 'new',
        image: form.image || undefined,
        images: form.images.length > 0 ? form.images : undefined,
        price: priceCents > 0 ? priceCents : 100000,
        stock: parseInt(form.stock, 10) || 0,
        sku: form.sku.trim() || undefined,
        status: asDraft ? 'draft' : 'active',
        styles: [],
        features: form.variants ? form.variants.split(',').map((s) => s.trim()).filter(Boolean) : [],
        colors: [],
      };

      if (editId) {
        await ProductService.update(editId, payload);
      } else {
        await ProductService.create(payload);
      }

      router.push(asDraft ? '/vendeur/dashboard/produits/brouillons' : '/vendeur/dashboard/produits');
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l’enregistrement du produit');
    } finally {
      setSaving(false);
    }
  };

  if (!can('catalog.write')) return <SellerCard><div role="alert" className="py-12 text-center"><p className="font-semibold text-brand-navy">Accès en lecture seule</p><p className="mt-2 text-sm text-gray-500">Votre rôle ne permet pas de créer ou modifier un produit.</p><SellerActionButton href="/vendeur/dashboard/produits" variant="secondary">Retour au catalogue</SellerActionButton></div></SellerCard>;
  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <SellerPageHeader
        title={editId ? 'Modifier le produit' : 'Ajouter un produit'}
        description={editId ? `Mise à jour de la fiche produit #${editId}` : 'Créez une fiche produit complète pour votre boutique.'}
        action={
          <SellerHeaderActions>
            <SellerActionButton variant="secondary" href="/vendeur/dashboard/produits">
              Annuler
            </SellerActionButton>
            <SellerActionButton variant="outline" onClick={() => save(true)} disabled={saving}>
              {saving ? 'Sauvegarde...' : 'Enregistrer brouillon'}
            </SellerActionButton>
          </SellerHeaderActions>
        }
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              i === step
                ? 'bg-brand-orange text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <SellerCard title={STEPS[step]}>
        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom du produit *</label>
              <input
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                placeholder="Ex: Sac à main en cuir véritable"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie *</label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange bg-white"
                value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
              >
                <option value="">Sélectionner une catégorie...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Marque</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                placeholder="Ex: Mande Artisanat"
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">État du produit</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange bg-white"
                value={form.condition}
                onChange={(e) => set('condition', e.target.value)}
              >
                <option value="new">Neuf</option>
                <option value="used_good">Occasion - Très bon état</option>
                <option value="refurbished">Reconditionné</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Description détaillée</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                rows={4}
                placeholder="Présentez les spécificités, matériaux et avantages de votre produit..."
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Photo principale de couverture</h4>
              <p className="text-xs text-gray-500 mb-3">Cette image sera mise en avant sur la boutique et dans les recherches.</p>
              <CloudinaryImageUpload
                currentImage={form.image}
                onImageChange={(url) => set('image', url)}
                placeholder="+ Choisir la photo principale"
              />
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Galerie de photos supplémentaires</h4>
              <p className="text-xs text-gray-500 mb-3">Ajoutez des angles de vue différents pour convaincre vos acheteurs.</p>
              
              <div className="flex flex-wrap gap-3 mb-3">
                {form.images.map((imgUrl, idx) => (
                  <div key={idx} className="relative group w-20 h-20 rounded-lg border overflow-hidden">
                    <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(idx)}
                      className="absolute inset-0 bg-red-600/75 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>

              <CloudinaryImageUpload
                currentImage=""
                onImageChange={addGalleryImage}
                placeholder="+ Ajouter une photo à la galerie"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid md:grid-cols-2 gap-4 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prix de vente (FCFA) *</label>
              <div className="relative">
                <input
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  type="number"
                  placeholder="Ex: 15000"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400">FCFA</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prix barré / Promo (Optionnel)</label>
              <div className="relative">
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  type="number"
                  placeholder="Ex: 12000"
                  value={form.promoPrice}
                  onChange={(e) => set('promoPrice', e.target.value)}
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400">FCFA</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quantité en stock *</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                type="number"
                min="0"
                placeholder="Ex: 25"
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code SKU / Référence</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Ex: SAC-CUIR-01"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Variantes (séparées par des virgules)</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Ex: Noir, Marron, Taille L, Taille XL"
                value={form.variants}
                onChange={(e) => set('variants', e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Indiquez les tailles, couleurs ou options disponibles pour ce modèle.</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Poids (kg)</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Ex: 0.8"
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Dimensions (L x l x H)</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Ex: 30x20x10 cm"
                value={form.dimensions}
                onChange={(e) => set('dimensions', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Délai de préparation</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Ex: 24h à 48h"
                value={form.prepDelay}
                onChange={(e) => set('prepDelay', e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-100">
          {step > 0 && (
            <SellerActionButton variant="secondary" onClick={() => setStep((s) => s - 1)}>
              Retour
            </SellerActionButton>
          )}
          {step < STEPS.length - 1 ? (
            <SellerActionButton variant="primary" onClick={() => setStep((s) => s + 1)}>
              Suivant
            </SellerActionButton>
          ) : (
            <>
              <SellerActionButton variant="secondary" onClick={() => save(true)} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer en brouillon'}
              </SellerActionButton>
              <SellerActionButton
                variant="primary"
                onClick={() => save(false)}
                disabled={saving || !form.name || !form.categoryId}
              >
                {saving ? 'En cours...' : editId ? 'Mettre à jour le produit' : 'Publier le produit'}
              </SellerActionButton>
            </>
          )}
          <SellerActionButton variant="ghost" href="/vendeur/dashboard/produits">
            Annuler
          </SellerActionButton>
        </div>
      </SellerCard>
    </div>
  );
}

export default function AjouterProduitPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" /></div>}>
      <ProductFormContent />
    </Suspense>
  );
}
