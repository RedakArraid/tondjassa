'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Product } from '../../types/index';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (product: Product, quantity: number, selectedColor?: string) => void;
  removeItem: (productId: number, selectedColor?: string) => void;
  updateQuantity: (productId: number, quantity: number, selectedColor?: string) => void;
  clearCart: () => void;
  getItemQuantity: (productId: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Charger le panier depuis localStorage au montage
  useEffect(() => {
    const savedCart = localStorage.getItem('mandemarket_cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        // Convertir les dates string en Date objects
        const cartWithDates = parsedCart.map((item: any) => ({
          ...item,
          product: {
            ...item.product,
            createdAt: new Date(item.product.createdAt),
            updatedAt: new Date(item.product.updatedAt),
          },
        }));
        setItems(cartWithDates);
      } catch (error) {
        console.error('Erreur lors du chargement du panier:', error);
        setItems([]);
      }
    }
    setIsHydrated(true);
  }, []);

  // Sauvegarder le panier dans localStorage quand il change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('mandemarket_cart', JSON.stringify(items));
    }
  }, [items, isHydrated]);

  const addItem = (product: Product, quantity: number, selectedColor?: string) => {
    setItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex(
        (item) => item.product.id === product.id && item.selectedColor === selectedColor
      );

      if (existingItemIndex >= 0) {
        // Mettre à jour la quantité si l'item existe déjà
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex].quantity += quantity;
        return updatedItems;
      } else {
        // Ajouter un nouvel item
        return [...prevItems, { product, quantity, selectedColor }];
      }
    });
  };

  const removeItem = (productId: number, selectedColor?: string) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.product.id === productId && item.selectedColor === selectedColor)
      )
    );
  };

  const updateQuantity = (productId: number, quantity: number, selectedColor?: string) => {
    if (quantity <= 0) {
      removeItem(productId, selectedColor);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId && item.selectedColor === selectedColor
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getItemQuantity = (productId: number): number => {
    const item = items.find((item) => item.product.id === productId);
    return item ? item.quantity : 0;
  };

  // Calculer totalItems et totalPrice avec useMemo pour éviter les recalculs inutiles
  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const totalPrice = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
