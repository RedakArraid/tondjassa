'use client';
import { logoutSession } from '../../../lib/api-fetch';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartBarIcon,
  CubeIcon,
  ShoppingBagIcon,
  MegaphoneIcon,
  PresentationChartLineIcon,
  BanknotesIcon,
  ChatBubbleLeftRightIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  EyeIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  BellIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { AuthService, SellerService } from '../../../config/api';
import { SELLER_NAV, findNavItem, type SellerNavItem } from './nav';

const ICONS: Record<SellerNavItem['icon'], React.ElementType> = {
  overview: ChartBarIcon,
  products: CubeIcon,
  orders: ShoppingBagIcon,
  marketing: MegaphoneIcon,
  stats: PresentationChartLineIcon,
  payments: BanknotesIcon,
  comms: ChatBubbleLeftRightIcon,
  store: BuildingStorefrontIcon,
  settings: Cog6ToothIcon,
};

const NOTIFS = [
  'Nouvelle commande',
  'Nouveau follower',
  'Nouveau message',
  'Nouvel avis',
  'Stock faible',
  'Paiement reçu',
  'Réponse du Super Admin',
];

function isNavActive(pathname: string, item: SellerNavItem) {
  if (item.href === '/vendeur/dashboard') return pathname === '/vendeur/dashboard';
  const base = item.href.replace(/\/(promotions|messages)$/, '');
  if (item.id === 'marketing') return pathname.startsWith('/vendeur/dashboard/marketing');
  if (item.id === 'comms') return pathname.startsWith('/vendeur/dashboard/communication');
  return pathname === item.href || pathname.startsWith(`${item.href}/`) || pathname.startsWith(`${base}/`);
}

function isChildActive(pathname: string, href: string) {
  return pathname === href;
}

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [ready, setReady] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const activeItem = useMemo(() => findNavItem(pathname || ''), [pathname]);

  useEffect(() => {
    const init = async () => {
      if (!AuthService.isAuthenticated()) {
        router.push('/admin/login');
        return;
      }
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('admin_user') : null;
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.role && u.role !== 'seller') {
            router.push('/admin/dashboard');
            return;
          }
          setUserEmail(u.email || '');
        } catch {}
      }
      try {
        setProfile(await SellerService.getMyProfile());
      } catch {}
      setReady(true);
    };
    init();
  }, [router]);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleLogout = async () => {
    try { await logoutSession('staff'); } catch (error) { window.alert(error instanceof Error ? error.message : 'Deconnexion non confirmee'); return; }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
    router.push('/admin/login');
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-orange" />
      </div>
    );
  }

  const storeName = profile?.storeName || 'Ma boutique';
  const storeHref = profile?.slug ? `/vendeur/${profile.slug}` : '/vendeur/dashboard/boutique';
  const statusBg =
    profile?.status === 'approved'
      ? 'bg-green-100 text-green-700'
      : profile?.status === 'pending'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-600';
  const statusLabel =
    profile?.status === 'approved'
      ? 'Approuvé'
      : profile?.status === 'pending'
      ? 'En attente'
      : profile?.status || 'Inconnu';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-brand-navy text-white flex flex-col transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-white/10">
          <p className="text-lg font-extrabold mb-3">
            <span className="text-white">Mandin</span>
            <span className="text-brand-orange-light">Market</span>
          </p>
          <div className="flex items-center gap-3">
            {profile?.logo ? (
              <img src={profile.logo} alt="" className="w-10 h-10 rounded-full object-cover border border-white/20" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <BuildingStorefrontIcon className="w-5 h-5 text-brand-orange-light" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-white/60">Espace vendeur</p>
              <p className="font-semibold text-sm truncate">{storeName}</p>
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBg}`}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-0.5 px-2">
            {SELLER_NAV.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isNavActive(pathname || '', item);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-brand-orange text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-white/50'}`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <main className="md:ml-64 flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Menu"
              >
                {sidebarOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
              </button>
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {activeItem?.label || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/vendeur/dashboard/produits/ajouter"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-dark"
              >
                <PlusIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Ajouter un produit</span>
              </Link>
              <Link
                href={storeHref}
                target={profile?.slug ? '_blank' : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-brand-navy hover:bg-gray-50"
              >
                <EyeIcon className="w-4 h-4" />
                <span className="hidden md:inline">Voir ma boutique</span>
              </Link>

              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => { setNotifOpen((v) => !v); setUserOpen(false); }}
                  className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                  aria-label="Notifications"
                >
                  <BellIcon className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-orange" />
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-brand-navy">
                      Notifications
                    </div>
                    <ul className="max-h-72 overflow-y-auto">
                      {NOTIFS.map((n) => (
                        <li key={n} className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50">
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <Link
                href="/vendeur/dashboard/communication/messages"
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Messages"
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
              </Link>

              <div className="relative" ref={userRef}>
                <button
                  type="button"
                  onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }}
                  className="flex items-center gap-2 p-1.5 sm:px-2 sm:py-1.5 rounded-lg hover:bg-gray-100"
                >
                  <UserCircleIcon className="w-6 h-6 text-gray-400" />
                  <span className="hidden lg:block text-sm text-gray-600 max-w-[140px] truncate">{userEmail}</span>
                </button>
                {userOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-50">
                    <Link href="/vendeur/dashboard/boutique" className="block px-4 py-2.5 text-sm hover:bg-gray-50">Ma boutique</Link>
                    <Link href="/vendeur/dashboard/parametres" className="block px-4 py-2.5 text-sm hover:bg-gray-50">Mon compte</Link>
                    <Link href="/contact" className="block px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2">
                      <QuestionMarkCircleIcon className="w-4 h-4" /> Centre d’aide
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4" /> Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {activeItem && activeItem.children.length > 0 && (
          <div className="bg-white border-b border-gray-200 px-4 md:px-6">
            <div className="flex gap-1 overflow-x-auto py-2">
              {activeItem.children.map((child) => {
                const active = isChildActive(pathname || '', child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-soft text-brand-orange'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-brand-navy'
                    }`}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
