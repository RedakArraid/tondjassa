'use client';

import { apiFetch as fetch, logoutSession } from '../lib/api-fetch';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
const TOKEN_KEY = 'mandemarket_customer_token';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  loyaltyPoints: number;
  totalSpent: number;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

interface CustomerAuthContextType {
  customer: Customer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  refreshCustomer: () => Promise<void>;
  logout: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCustomer = useCallback(async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      setCustomer(null);
      return;
    }
    try {
      const res = await fetch(`${API}/api/account/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
        setCustomer(null);
      }
    } catch {
      // ignore network errors on refresh
    }
  }, []);

  // Au montage, valider le token si présent
  useEffect(() => {
    const validateToken = async () => {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API}/api/account/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCustomer(data.customer);
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    validateToken();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/api/account/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
    sessionStorage.setItem(TOKEN_KEY, data.token);
    setCustomer(data.customer);
  }, []);

  const register = useCallback(async (registerData: RegisterData) => {
    const res = await fetch(`${API}/api/account/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur lors de l'inscription");
    // Registration only sends verification instructions, never authenticates.
  }, []);

  const logout = useCallback(() => {
    void logoutSession('customer').then(() => setCustomer(null)).catch((error) => window.alert(error.message));
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isAuthenticated: !!customer,
        isLoading,
        login,
        register,
        refreshCustomer,
        logout,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth doit être utilisé dans CustomerAuthProvider');
  return ctx;
}
