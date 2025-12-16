"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import {
  addToCart,
  updateCartItem,
  removeFromCart,
  applyPromoCode,
  getCart,
} from "./server-actions/ecommerce";

export interface CartItem {
  product_id: string;
  variant_id?: string;
  sku?: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  image_url?: string;
}

export interface Cart {
  cart_id: string;
  customer_id: string;
  items: CartItem[];
  subtotal_cents: number;
  tax_cents: number;
  shipping_cost_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  applied_promo_codes: string[];
}

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  error: Error | null;
  addItem: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  applyPromo: (code: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const updatedCart = await getCart();
      setCart(updatedCart);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addItem = useCallback(
    async (productId: string, quantity: number, variantId?: string) => {
      try {
        setIsLoading(true);
        const updatedCart = await addToCart({
          product_id: productId,
          variant_id: variantId,
          quantity,
        });
        setCart(updatedCart);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to add item"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateItem = useCallback(
    async (productId: string, quantity: number) => {
      try {
        setIsLoading(true);
        const updatedCart = await updateCartItem(productId, { quantity });
        setCart(updatedCart);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to update item"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const removeItem = useCallback(async (productId: string) => {
    try {
      setIsLoading(true);
      const updatedCart = await removeFromCart(productId);
      setCart(updatedCart);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to remove item"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const applyPromo = useCallback(async (code: string) => {
    try {
      setIsLoading(true);
      const updatedCart = await applyPromoCode(code);
      setCart(updatedCart);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to apply promo"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        error,
        addItem,
        updateItem,
        removeItem,
        applyPromo,
        refresh,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}

export function useMiniCart() {
  const { cart, isLoading } = useCart();
  return {
    itemCount: cart?.items.length ?? 0,
    total: cart?.total_cents ?? 0,
    currency: cart?.currency ?? "USD",
    isLoading,
  };
}
