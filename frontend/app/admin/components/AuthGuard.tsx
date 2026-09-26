'use client';

import { apiFetch as fetch } from '../../lib/api-fetch';
import { useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
const ALLOWED_ROLES = ['admin', 'manager'];

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    setLoading(true);
    setNetworkError(null);

    const token = sessionStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.user;

        // Seuls les rôles admin et manager sont formellement autorisés (MM-FE-020)
        if (!user || !ALLOWED_ROLES.includes(user.role)) {
          if (user?.role === 'seller') {
            router.push('/vendeur/dashboard');
          } else {
            router.push('/admin/login?error=unauthorized');
          }
          return;
        }

        setIsAuthenticated(true);
      } else if (response.status === 401 || response.status === 403) {
        // Token expiré ou révoqué
        sessionStorage.removeItem('admin_token');
        sessionStorage.removeItem('admin_user');
        router.push('/admin/login?error=expired');
      } else {
        setNetworkError('Erreur serveur lors de la vérification des droits');
      }
    } catch (err) {
      console.error('Erreur réseau AuthGuard:', err);
      // Règle stricte MM-FE-020: Ne JAMAIS autoriser l'accès lors d'une erreur réseau
      setIsAuthenticated(false);
      setNetworkError('Connexion au serveur d\'authentification impossible. Vérifiez votre réseau.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vérification de sécurité...</h2>
          <p className="text-gray-600">Authentification et contrôle de rôle en cours</p>
        </div>
      </div>
    );
  }

  if (networkError) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6 text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Erreur de sécurité</h3>
          <p className="text-sm text-gray-600 mb-6">{networkError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={checkAuth}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition"
            >
              Réessayer
            </button>
            <button
              onClick={() => router.push('/admin/login')}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Retour connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
