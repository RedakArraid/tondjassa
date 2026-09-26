'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté
    const token = sessionStorage.getItem('admin_token');
    
    if (token) {
      // Si connecté, rediriger vers le dashboard CRUD
      router.push('/admin/dashboard');
    } else {
      // Si non connecté, rediriger vers login
      router.push('/admin/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">MandeMarket Admin</h2>
        <p className="text-gray-600">Redirection vers l'interface CRUD...</p>
      </div>
    </div>
  );
}
