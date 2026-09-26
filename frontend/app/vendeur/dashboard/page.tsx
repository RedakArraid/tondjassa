'use client';

import { useEffect, useState } from 'react';
import { SellerService } from '../../config/api';
import { Spinner } from './_components/sections';
import {
  SellerActionButton,
  SellerHeaderActions,
  SellerCard,
  SellerEmptyState,
  RowActions,
} from './_components/ui';

function fmt(cents: number) {
  return `${Math.round((cents || 0) / 100).toLocaleString('fr-FR')} FCFA`;
}

export default function VendeurOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    Promise.allSettled([
      SellerService.getMyEarnings(),
      SellerService.getMyProducts(1),
      SellerService.getMyOrders(1),
      SellerService.getMyCustomers(),
    ]).then((results) => {
      if (results[0].status === 'fulfilled') setEarnings(results[0].value);
      if (results[1].status === 'fulfilled') setProducts(results[1].value?.products || []);
      if (results[2].status === 'fulfilled') setOrders(results[2].value?.orders || []);
      if (results[3].status === 'fulfilled') setCustomers(Array.isArray(results[3].value) ? results[3].value : []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const lowStock = products.filter((p) => (p.stock ?? 0) <= 5);
  const catalogProducts = [...products].slice(0, 5);
  const recentOrders = orders.slice(0, 5);
  const available = earnings?.availableBalance ?? earnings?.totalEarnings ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-navy">Vue d’ensemble</h2>
        <p className="text-sm text-gray-500 mt-1">Résumé de l’activité de votre boutique.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SellerCard title="Chiffre d’affaires">
          <p className="text-2xl font-bold text-brand-navy mb-4">{fmt(earnings?.totalSales ?? 0)}</p>
          <SellerActionButton href="/vendeur/dashboard/statistiques" size="sm" variant="secondary">
            Voir les statistiques
          </SellerActionButton>
        </SellerCard>

        <SellerCard title="Commandes">
          <p className="text-2xl font-bold text-brand-navy mb-4">{earnings?.totalOrders ?? orders.length}</p>
          <SellerActionButton href="/vendeur/dashboard/commandes" size="sm" variant="secondary">
            Voir les commandes
          </SellerActionButton>
        </SellerCard>

        <SellerCard title="Solde disponible">
          <p className="text-2xl font-bold text-brand-navy mb-4">{fmt(available)}</p>
          <SellerHeaderActions>
            <SellerActionButton href="/vendeur/dashboard/paiements" size="sm" variant="secondary">
              Voir mon solde
            </SellerActionButton>
            <SellerActionButton href="/vendeur/dashboard/paiements/retraits" size="sm" variant="primary">
              Demander un retrait
            </SellerActionButton>
          </SellerHeaderActions>
        </SellerCard>

        <SellerCard title="Produits">
          <p className="text-2xl font-bold text-brand-navy mb-4">{products.length}</p>
          <SellerHeaderActions>
            <SellerActionButton href="/vendeur/dashboard/produits" size="sm" variant="secondary">
              Voir mes produits
            </SellerActionButton>
            <SellerActionButton href="/vendeur/dashboard/produits/ajouter" size="sm" variant="primary">
              + Ajouter un produit
            </SellerActionButton>
          </SellerHeaderActions>
        </SellerCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SellerCard
          title="Clients acheteurs"
          action={
            <SellerActionButton href="/vendeur/dashboard/statistiques/abonnes" size="sm" variant="ghost">
              Voir mes clients
            </SellerActionButton>
          }
        >
          <p className="text-3xl font-bold text-brand-navy">{customers.length}</p>
          <p className="text-xs text-gray-500 mt-1">ayant commandé dans votre boutique</p>
        </SellerCard>

        <SellerCard title="Alertes" className="lg:col-span-2">
          <div className="space-y-3">
            {lowStock.slice(0, 3).map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-red-100 bg-red-50/50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-red-700">Stock faible — {p.name}</p>
                  <p className="text-xs text-red-600">{p.stock ?? 0} unité(s) restante(s)</p>
                </div>
                <RowActions>
                  <SellerActionButton href="/vendeur/dashboard/produits" size="sm" variant="secondary">Voir le produit</SellerActionButton>
                  <SellerActionButton permission="catalog.write" href="/vendeur/dashboard/produits/stock" size="sm" variant="primary">Mettre à jour le stock</SellerActionButton>
                </RowActions>
              </div>
            ))}
            {orders[0] && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-blue-100 bg-blue-50/40 rounded-lg px-3 py-2">
                <p className="text-sm font-semibold text-blue-800">Nouvelle commande #{String(orders[0].id).slice(0, 8)}</p>
                <SellerActionButton href="/vendeur/dashboard/commandes" size="sm" variant="secondary">Voir la commande</SellerActionButton>
              </div>
            )}
            {lowStock.length === 0 && !orders[0] && (
              <p className="text-sm text-gray-500">Aucune alerte critique pour le moment.</p>
            )}
          </div>
        </SellerCard>
      </div>

      <SellerCard
        title="Commandes récentes"
        action={
          <SellerActionButton href="/vendeur/dashboard/commandes" size="sm" variant="ghost">
            Voir toutes les commandes
          </SellerActionButton>
        }
      >
        {recentOrders.length === 0 ? (
          <SellerEmptyState title="Aucune commande" description="Les nouvelles commandes apparaîtront ici." actionLabel="Voir les produits" actionHref="/vendeur/dashboard/produits" />
        ) : (
          <div className="space-y-3">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-brand-navy">#{String(o.id).slice(0, 8)}</p>
                  <p className="text-sm text-gray-500">
                    {o.customer?.firstName} {o.customer?.lastName} · {fmt(o.totalAmount ?? 0)} · {o.status}
                  </p>
                </div>
                <RowActions>
                  <SellerActionButton href="/vendeur/dashboard/commandes" size="sm" variant="secondary">Voir</SellerActionButton>
                  <SellerActionButton permission="orders.write" href="/vendeur/dashboard/commandes/a-preparer" size="sm" variant="primary">Préparer</SellerActionButton>
                  <SellerActionButton href="/vendeur/dashboard/commandes" size="sm" variant="outline">Gérer commande</SellerActionButton>
                  <SellerActionButton permission="orders.write" href="/vendeur/dashboard/communication/messages" size="sm" variant="ghost">Contacter le client</SellerActionButton>
                </RowActions>
              </div>
            ))}
          </div>
        )}
      </SellerCard>

      <SellerCard title="Aperçu du catalogue">
        {catalogProducts.length === 0 ? (
          <SellerEmptyState title="Aucun produit" description="Ajoutez des produits pour commencer." actionLabel="+ Ajouter un produit" actionHref="/vendeur/dashboard/produits/ajouter" />
        ) : (
          <div className="space-y-3">
            {catalogProducts.map((p) => (
              <div key={p.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-gray-100" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy truncate">{p.name}</p>
                    <p className="text-sm text-gray-500">{fmt(p.price ?? 0)} · Stock {p.stock ?? 0}</p>
                  </div>
                </div>
                <RowActions>
                  <SellerActionButton href={`/boutique/${p.id}`} size="sm" variant="secondary">Voir</SellerActionButton>
                  <SellerActionButton href="/vendeur/dashboard/produits" size="sm" variant="primary">Modifier</SellerActionButton>
                  <SellerActionButton href="/vendeur/dashboard/statistiques/produits" size="sm" variant="ghost">Voir les statistiques</SellerActionButton>
                </RowActions>
              </div>
            ))}
          </div>
        )}
      </SellerCard>
    </div>
  );
}
