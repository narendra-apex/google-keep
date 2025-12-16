"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getBrandConfigSection,
  getBrandMetadataSchemaExamples,
  listBrands,
  listCategories,
  listProducts,
  updateBrandConfigSection,
  type Brand,
  type BrandConfigSectionKey,
  type Category,
  type PaginatedResponse,
  type Product,
} from "@/lib/server-actions/brands";
import { useToast } from "@/components/ui/toast";

export function useBrands({
  limit = 12,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const brandsQuery = useQuery({
    queryKey: ["brands", limit, offset],
    queryFn: () => listBrands({ limit, offset }),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
  });

  const productsQuery = useQuery({
    queryKey: ["products", 10, 0],
    queryFn: () => listProducts({ limit: 10, offset: 0 }),
  });

  const schemaExamplesQuery = useQuery({
    queryKey: ["brand-metadata-schema-examples"],
    queryFn: () => getBrandMetadataSchemaExamples(),
    staleTime: 5 * 60 * 1000,
  });

  const updateConfigMutation = useMutation({
    mutationFn: updateBrandConfigSection,
    onMutate: async (vars) => {
      const key = ["brand-config", vars.brandId, vars.section] as const;
      await qc.cancelQueries({ queryKey: key });

      const previous = qc.getQueryData(key);
      qc.setQueryData(key, vars.value);

      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData(ctx.key, ctx.previous);
      toast({ title: "Save failed", description: "Reverted changes.", variant: "error" });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Brand configuration updated.", variant: "success" });
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["brand-config", vars.brandId, vars.section] });
    },
  });

  return {
    brandsQuery,
    categoriesQuery,
    productsQuery,
    schemaExamplesQuery,
    updateConfigMutation,
  };
}

export function useBrandConfigSection<T>(
  brandId: string | undefined,
  section: BrandConfigSectionKey
) {
  return useQuery({
    queryKey: ["brand-config", brandId, section],
    queryFn: () => {
      if (!brandId) throw new Error("brandId required");
      return getBrandConfigSection<T>({ brandId, section });
    },
    enabled: Boolean(brandId),
  });
}

export type { Brand, Product, Category, PaginatedResponse };
