"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/utils";
import { checkoutCart } from "@/lib/server-actions/ecommerce";
import { ChevronRight } from "lucide-react";

type CheckoutStep = "shipping" | "payment" | "review" | "confirmation";

interface ShippingFormData {
  firstName: string;
  lastName: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface PaymentFormData {
  method: string;
  shippingMethod: string;
  sameAsBilling: boolean;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
}

export default function CheckoutPage({ params }: { params: Promise<{ brand: string }> }) {
  const { cart, isLoading: cartLoading } = useCart();
  const [step, setStep] = useState<CheckoutStep>("shipping");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [brand, setBrand] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { brand: b } = await params;
      setBrand(b);
    })();
  }, [params]);

  const [shippingData, setShippingData] = useState<ShippingFormData>({
    firstName: "",
    lastName: "",
    email: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  const [paymentData, setPaymentData] = useState<PaymentFormData>({
    method: "credit_card",
    shippingMethod: "standard",
    sameAsBilling: true,
  });

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-error mb-4">Checkout</h1>
          <p className="text-gray-600 mb-8">Your cart is empty</p>
          {brand && (
            <Link
              href={`/${brand}`}
              className="inline-block bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90"
            >
              Continue Shopping
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="container py-12">
        <div className="max-w-md mx-auto">
          <div className="bg-success bg-opacity-10 border border-success rounded-lg p-8 text-center">
            <div className="text-4xl text-success mb-4">✓</div>
            <h1 className="text-2xl font-bold text-text mb-2">Order Confirmed!</h1>
            <p className="text-gray-600 mb-6">
              Your order has been received. Order ID: {orderId}
            </p>
            <p className="text-gray-600 mb-6">
              A confirmation email has been sent to {shippingData.email}
            </p>
            <Link
              href={`/${brand}`}
              className="inline-block bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("payment");
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("review");
  };

  const handleCheckout = async () => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await checkoutCart({
        shipping_address: {
          street: shippingData.street,
          city: shippingData.city,
          postal_code: shippingData.postalCode,
          state: shippingData.state,
          country: shippingData.country,
        },
        billing_address: !paymentData.sameAsBilling
          ? {
              street: paymentData.billingStreet,
              city: paymentData.billingCity,
              state: paymentData.billingState,
              postal_code: paymentData.billingPostalCode,
              country: paymentData.billingCountry,
            }
          : undefined,
        payment_method: paymentData.method,
        shipping_method: paymentData.shippingMethod,
      });

      setOrderId(response.order_id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during checkout. Please try again."
      );
      console.error("Checkout error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold text-text mb-8">Checkout</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Steps */}
        <div className="md:col-span-2">
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={() => setStep("shipping")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                step === "shipping"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              1. Shipping
            </button>
            <ChevronRight size={20} className="text-gray-400" />
            <button
              onClick={() => setStep("payment")}
              disabled={step === "shipping"}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                step === "payment"
                  ? "bg-primary text-white"
                  : step === "shipping"
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              2. Payment
            </button>
            <ChevronRight size={20} className="text-gray-400" />
            <button
              onClick={() => setStep("review")}
              disabled={step === "shipping" || step === "payment"}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                step === "review"
                  ? "bg-primary text-white"
                  : ["shipping", "payment"].includes(step)
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              3. Review
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-error bg-opacity-10 border border-error rounded-lg p-4 mb-6 text-error">
              {error}
            </div>
          )}

          {/* Shipping Step */}
          {step === "shipping" && (
            <form onSubmit={handleShippingSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-text mb-6">Shipping Address</h2>

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={shippingData.firstName}
                  onChange={(e) =>
                    setShippingData({ ...shippingData, firstName: e.target.value })
                  }
                  required
                  className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={shippingData.lastName}
                  onChange={(e) =>
                    setShippingData({ ...shippingData, lastName: e.target.value })
                  }
                  required
                  className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <input
                type="email"
                placeholder="Email"
                value={shippingData.email}
                onChange={(e) =>
                  setShippingData({ ...shippingData, email: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />

              <input
                type="text"
                placeholder="Street Address"
                value={shippingData.street}
                onChange={(e) =>
                  setShippingData({ ...shippingData, street: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="City"
                  value={shippingData.city}
                  onChange={(e) =>
                    setShippingData({ ...shippingData, city: e.target.value })
                  }
                  required
                  className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={shippingData.state}
                  onChange={(e) =>
                    setShippingData({ ...shippingData, state: e.target.value })
                  }
                  className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Postal Code"
                  value={shippingData.postalCode}
                  onChange={(e) =>
                    setShippingData({ ...shippingData, postalCode: e.target.value })
                  }
                  required
                  className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Country"
                  value={shippingData.country}
                  onChange={(e) =>
                    setShippingData({ ...shippingData, country: e.target.value })
                  }
                  required
                  className="col-span-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 mt-6"
              >
                Continue to Payment
              </button>
            </form>
          )}

          {/* Payment Step */}
          {step === "payment" && (
            <form onSubmit={handlePaymentSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-text mb-6">Payment Method</h2>

              <div>
                <label className="block font-semibold text-text mb-3">Payment Method</label>
                <select
                  value={paymentData.method}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, method: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="paypal">PayPal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-text mb-3">Shipping Method</label>
                <div className="space-y-2">
                  {[
                    { value: "standard", label: "Standard (5-7 days)" },
                    { value: "express", label: "Express (2-3 days)" },
                    { value: "overnight", label: "Overnight" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="shippingMethod"
                        value={option.value}
                        checked={paymentData.shippingMethod === option.value}
                        onChange={(e) =>
                          setPaymentData({
                            ...paymentData,
                            shippingMethod: e.target.value,
                          })
                        }
                        className="mr-3"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={paymentData.sameAsBilling}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        sameAsBilling: e.target.checked,
                      })
                    }
                    className="mr-3"
                  />
                  <span className="font-medium text-text">
                    Billing address same as shipping
                  </span>
                </label>
              </div>

              {!paymentData.sameAsBilling && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="font-semibold text-text">Billing Address</h3>
                  <input
                    type="text"
                    placeholder="Street Address"
                    value={paymentData.billingStreet || ""}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        billingStreet: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="City"
                    value={paymentData.billingCity || ""}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        billingCity: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="State"
                      value={paymentData.billingState || ""}
                      onChange={(e) =>
                        setPaymentData({
                          ...paymentData,
                          billingState: e.target.value,
                        })
                      }
                      className="px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Postal Code"
                      value={paymentData.billingPostalCode || ""}
                      onChange={(e) =>
                        setPaymentData({
                          ...paymentData,
                          billingPostalCode: e.target.value,
                        })
                      }
                      className="px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep("shipping")}
                  className="flex-1 border border-gray-300 text-text py-3 rounded-lg font-semibold hover:bg-gray-100"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90"
                >
                  Continue to Review
                </button>
              </div>
            </form>
          )}

          {/* Review Step */}
          {step === "review" && (
            <div className="space-y-6">
              {/* Shipping Review */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-text">Shipping Address</h3>
                  <button
                    onClick={() => setStep("shipping")}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-gray-600">
                  {shippingData.firstName} {shippingData.lastName}
                </p>
                <p className="text-gray-600">{shippingData.street}</p>
                <p className="text-gray-600">
                  {shippingData.city}, {shippingData.state} {shippingData.postalCode}
                </p>
                <p className="text-gray-600">{shippingData.country}</p>
                <p className="text-gray-600 mt-2">Email: {shippingData.email}</p>
              </div>

              {/* Payment Review */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-text">Payment Method</h3>
                  <button
                    onClick={() => setStep("payment")}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-gray-600">
                  {paymentData.method.replace(/_/g, " ")}
                </p>
                <p className="text-gray-600 mt-2">
                  Shipping: {paymentData.shippingMethod}
                </p>
              </div>

              {/* Checkout Button */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("payment")}
                  className="flex-1 border border-gray-300 text-text py-3 rounded-lg font-semibold hover:bg-gray-100"
                >
                  Back
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? "Processing..." : "Place Order"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="md:col-span-1">
          <div className="bg-gray-50 rounded-lg p-6 sticky top-20">
            <h2 className="text-xl font-bold text-text mb-6">Order Summary</h2>

            <div className="space-y-3 mb-6">
              {cart.items.map((item) => (
                <div key={item.product_id} className="flex items-start justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-text">{item.name}</p>
                    <p className="text-gray-600">x{item.quantity}</p>
                  </div>
                  <p className="font-medium text-text">
                    {formatPrice(item.line_total_cents, cart.currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2 mb-6">
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
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between">
                <span className="font-bold text-text">Total</span>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(cart.total_cents, cart.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
