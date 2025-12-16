"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";

async function makeRequest(
  method: string,
  endpoint: string,
  body?: Record<string, any>
) {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get("tenant_id")?.value;
  const brandId = cookieStore.get("brand_id")?.value;
  const sessionId = cookieStore.get("session_id")?.value;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }
  if (brandId) {
    headers["x-brand-id"] = brandId;
  }
  if (sessionId) {
    headers["cookie"] = `session_id=${sessionId}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function addToCart(data: {
  product_id: string;
  variant_id?: string;
  quantity: number;
}) {
  return makeRequest("POST", "/cart/items", data);
}

export async function updateCartItem(
  productId: string,
  data: { quantity: number }
) {
  return makeRequest("PATCH", `/cart/items/${productId}`, data);
}

export async function removeFromCart(productId: string) {
  return makeRequest("DELETE", `/cart/items/${productId}`);
}

export async function applyPromoCode(code: string) {
  return makeRequest("POST", "/cart/apply-promo", { code });
}

export async function checkoutCart(data: {
  shipping_address: {
    street: string;
    city: string;
    postal_code: string;
    state?: string;
    country?: string;
  };
  billing_address?: Record<string, any>;
  payment_method: string;
  shipping_method?: string;
}) {
  return makeRequest("POST", "/cart/checkout", data);
}

export async function getCart() {
  return makeRequest("GET", "/cart");
}
