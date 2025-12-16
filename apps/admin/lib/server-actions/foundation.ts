"use server";

import { cookies } from "next/headers";

export type FoundationContextHeaders = {
  "x-tenant-id"?: string;
  "x-brand-id"?: string;
  Authorization?: string;
};

function safeCookies() {
  try {
    return cookies();
  } catch {
    return null;
  }
}

export function getFoundationContextHeaders(): FoundationContextHeaders {
  const c = safeCookies();

  const tenantId = c?.get("tenant_id")?.value ?? "default-tenant";
  const brandId = c?.get("brand_id")?.value;

  const token = c?.get("auth_token")?.value;

  return {
    ...(tenantId ? { "x-tenant-id": tenantId } : {}),
    ...(brandId ? { "x-brand-id": brandId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function withQuery(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function safeJson(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function foundationFetch<T>(
  path: string,
  {
    method = "GET",
    query,
    headers,
    body,
    cache,
  }: {
    method?: string;
    query?: Record<string, string | number | boolean | undefined | null>;
    headers?: HeadersInit;
    body?: unknown;
    cache?: RequestCache;
  } = {}
): Promise<T> {
  const baseUrl = process.env.FOUNDATION_API_URL || "https://api.example.com/v1";
  const url = `${baseUrl}${withQuery(path, query)}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...getFoundationContextHeaders(),
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache,
  });

  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new Error(
      `Foundation API error ${res.status} ${res.statusText}: ${typeof errBody === "string" ? errBody : JSON.stringify(errBody)}`
    );
  }

  return (await safeJson(res)) as T;
}
