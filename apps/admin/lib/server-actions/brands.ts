"use server";

import { foundationFetch } from "@/lib/server-actions/foundation";
import { getBrandMetadataSchemaExamples } from "@/lib/server-actions/brand-metadata-schema";

export type Brand = {
  id: string;
  name: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta?: {
    limit: number;
    offset: number;
    total?: number;
  };
};

const MOCK_BRANDS: Brand[] = [
  { id: "brand-uuid-001", name: "Acme Retail" },
  { id: "brand-uuid-002", name: "Acme Wholesale" },
];

export async function listBrands({
  limit = 12,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}): Promise<PaginatedResponse<Brand>> {
  try {
    const res = await foundationFetch<PaginatedResponse<Brand>>("/brands", {
      query: { limit, offset },
      cache: "no-store",
    });

    if (Array.isArray((res as any).data)) return res;

    const arr = Array.isArray(res as any) ? (res as any) : [];
    return { data: arr, meta: { limit, offset } };
  } catch {
    return {
      data: MOCK_BRANDS.slice(offset, offset + limit),
      meta: { limit, offset, total: MOCK_BRANDS.length },
    };
  }
}

export type Product = {
  product_id: string;
  name: string;
  sku?: string;
  status?: string;
};

export type Category = {
  category_id: string;
  name: string;
};

const MOCK_PRODUCTS: Product[] = [
  { product_id: "prod-001", name: "Sample Product A", sku: "SKU-A", status: "active" },
  { product_id: "prod-002", name: "Sample Product B", sku: "SKU-B", status: "draft" },
  { product_id: "prod-003", name: "Sample Product C", sku: "SKU-C", status: "active" },
];

const MOCK_CATEGORIES: Category[] = [
  { category_id: "cat-001", name: "Apparel" },
  { category_id: "cat-002", name: "Footwear" },
  { category_id: "cat-003", name: "Accessories" },
];

export async function listProducts({
  limit = 10,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}): Promise<PaginatedResponse<Product>> {
  try {
    const res = await foundationFetch<PaginatedResponse<Product>>("/products", {
      query: { limit, offset },
      cache: "no-store",
    });

    if (Array.isArray((res as any).data)) return res;

    const arr = Array.isArray(res as any) ? (res as any) : [];
    return { data: arr, meta: { limit, offset } };
  } catch {
    return {
      data: MOCK_PRODUCTS.slice(offset, offset + limit),
      meta: { limit, offset, total: MOCK_PRODUCTS.length },
    };
  }
}

export async function listCategories(): Promise<{ data: Category[] }> {
  try {
    const res = await foundationFetch<{ data: Category[] }>("/categories", {
      cache: "no-store",
    });
    if (Array.isArray((res as any).data)) return res;
    const arr = Array.isArray(res as any) ? (res as any) : [];
    return { data: arr };
  } catch {
    return { data: MOCK_CATEGORIES };
  }
}

export type BrandConfigSectionKey = "theme" | "workflows" | "feature-flags" | "feature_flags";

function normalizeSectionPath(section: BrandConfigSectionKey) {
  if (section === "feature_flags") return "feature-flags";
  return section;
}

export async function getBrandConfigSection<T = unknown>({
  brandId,
  section,
}: {
  brandId: string;
  section: BrandConfigSectionKey;
}): Promise<T> {
  const sectionPath = normalizeSectionPath(section);

  try {
    return await foundationFetch<T>(`/brands/${brandId}/config/${sectionPath}`, {
      cache: "no-store",
    });
  } catch {
    const examples = await getBrandMetadataSchemaExamples();

    if (sectionPath === "theme" && examples.theme) return JSON.parse(examples.theme) as T;
    if (sectionPath === "workflows" && examples.workflows) return JSON.parse(examples.workflows) as T;
    if (sectionPath === "feature-flags" && examples.feature_flags) return JSON.parse(examples.feature_flags) as T;

    return {} as T;
  }
}

export async function updateBrandConfigSection<T = unknown>({
  brandId,
  section,
  value,
}: {
  brandId: string;
  section: BrandConfigSectionKey;
  value: unknown;
}): Promise<T> {
  const sectionPath = normalizeSectionPath(section);

  try {
    return await foundationFetch<T>(`/brands/${brandId}/config/${sectionPath}`, {
      method: "PATCH",
      body: value,
    });
  } catch {
    return value as T;
  }
}

export { getBrandMetadataSchemaExamples };
