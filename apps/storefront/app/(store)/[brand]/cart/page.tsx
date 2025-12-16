"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/utils";
import { Trash2, Plus, Minus } from "lucide-react";
import { useEffect, useState } from "react";

export default function CartPage({ params }: { params: Promise<{ brand: string }> }) {
  const { cart, isLoading, updateItem, removeItem, refresh } = useCart();
  const [mounted, setMounted] = useState(false);
  const [brand, setBrand] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { brand: b } = await params;
      setBrand(b);
      setMounted(true);
      refresh();
    })();
  }, [params, refresh]);

  if (!mounted) {
    return <div className="container py-12">Loading...</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text mb-4">Shopping Cart</h1>
          <p className="text-gray-600 mb-8">Your cart is empty</p>
          <Link
            href={`/${brand}`}
            className="inline-block bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold text-text mb-8">Shopping Cart</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="md:col-span-2">
          <div className="space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.product_id}
                className="flex gap-4 p-4 border border-gray-200 rounded-lg"
              >
                {/* Image */}
                {item.image_url && (
                  <div className="w-24 h-24 flex-shrink-0">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover rounded"
                    />
                  </div>
                )}

                {/* Item Details */}
                <div className="flex-1">
                  <Link
                    href={`/${brand}/products/${item.product_id}`}
                    className="font-semibold text-text hover:text-primary mb-2 block"
                  >
                    {item.name}
                  </Link>
                  {item.sku && (
                    <p className="text-sm text-gray-600 mb-2">SKU: {item.sku}</p>
                  )}
                  <p className="text-primary font-semibold">
                    {formatPrice(item.unit_price_cents, cart.currency)}
                  </p>
                </div>

                {/* Quantity and Actions */}
                <div className="flex flex-col items-end gap-4">
                  {/* Quantity */}
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() =>
                        updateItem(item.product_id, Math.max(1, item.quantity - 1))
                      }
                      disabled={isLoading}
                      className="p-1 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="px-3 py-1 text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateItem(item.product_id, item.quantity + 1)}
                      disabled={isLoading}
                      className="p-1 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Line Total */}
                  <p className="text-right font-semibold">
                    {formatPrice(item.line_total_cents, cart.currency)}
                  </p>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(item.product_id)}
                    disabled={isLoading}
                    className="text-error hover:text-error hover:opacity-70 disabled:opacity-50 p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Continue Shopping */}
          <Link
            href={`/${brand}`}
            className="inline-block text-primary hover:underline mt-6"
          >
            ← Continue Shopping
          </Link>
        </div>

        {/* Order Summary */}
        <div className="md:col-span-1">
          <div className="bg-gray-50 rounded-lg p-6 sticky top-20">
            <h2 className="text-xl font-bold text-text mb-6">Order Summary</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-text font-medium">
                  {formatPrice(cart.subtotal_cents, cart.currency)}
                </span>
              </div>

              {cart.tax_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="text-text font-medium">
                    {formatPrice(cart.tax_cents, cart.currency)}
                  </span>
                </div>
              )}

              {cart.shipping_cost_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-text font-medium">
                    {formatPrice(cart.shipping_cost_cents, cart.currency)}
                  </span>
                </div>
              )}

              {cart.discount_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="text-success font-medium">
                    -{formatPrice(cart.discount_cents, cart.currency)}
                  </span>
                </div>
              )}

              {cart.applied_promo_codes.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Applied Promo Codes:</p>
                  <div className="space-y-1">
                    {cart.applied_promo_codes.map((code) => (
                      <span
                        key={code}
                        className="block text-sm bg-success bg-opacity-10 text-success px-2 py-1 rounded text-center"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-6 mb-6">
              <div className="flex justify-between">
                <span className="font-bold text-text">Total</span>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(cart.total_cents, cart.currency)}
                </span>
              </div>
            </div>

            <Link
              href={`/${brand}/checkout`}
              className="w-full block text-center bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 mb-3"
            >
              Checkout
            </Link>

            <button
              disabled={isLoading}
              className="w-full border border-gray-300 text-text py-2 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
