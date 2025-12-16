"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getFeatureFlagAuditTrail,
  getFeatureFlagsConfig,
  updateFeatureFlagsConfig,
  type FeatureFlagAuditEvent,
  type FeatureFlagsConfig,
} from "@/lib/server-actions/feature-flags";
import {
  flattenFeatureFlags,
  setFeatureFlagInConfig,
  type FlattenedFeatureFlag,
} from "@/lib/adapters/feature-flags";
import { useToast } from "@/components/ui/toast";

export function useFeatureFlags({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const configQuery = useQuery({
    queryKey: ["feature-flags-config", brandId],
    queryFn: () => getFeatureFlagsConfig({ brandId }),
  });

  const flags = React.useMemo<FlattenedFeatureFlag[]>(
    () => flattenFeatureFlags(configQuery.data),
    [configQuery.data]
  );

  const updateFlagMutation = useMutation({
    mutationFn: async ({
      keyPath,
      patch,
    }: {
      keyPath: string;
      patch: Partial<{ enabled: boolean; rollout_percentage: number; scheduled_rollout: any }>;
    }) => {
      const next = setFeatureFlagInConfig({
        config: configQuery.data,
        keyPath,
        patch,
      }) as FeatureFlagsConfig;

      return await updateFeatureFlagsConfig({ brandId, value: next });
    },
    onMutate: async ({ keyPath, patch }) => {
      const key = ["feature-flags-config", brandId] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FeatureFlagsConfig>(key);

      const next = setFeatureFlagInConfig({
        config: previous,
        keyPath,
        patch,
      }) as FeatureFlagsConfig;

      qc.setQueryData(key, next);
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData(ctx.key, ctx.previous);
      toast({ title: "Update failed", description: "Reverted changes.", variant: "error" });
    },
    onSuccess: () => {
      toast({ title: "Feature flag updated", variant: "success" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["feature-flags-config", brandId] });
    },
  });

  return {
    configQuery,
    flags,
    updateFlagMutation,
  };
}

export function useFeatureFlagAuditTrailQuery(flagKeyPath: string | undefined) {
  return useQuery({
    queryKey: ["feature-flag-audit", flagKeyPath],
    queryFn: () => {
      if (!flagKeyPath) throw new Error("flagKeyPath required");
      return getFeatureFlagAuditTrail({ flagKeyPath });
    },
    enabled: Boolean(flagKeyPath),
  });
}

export type { FeatureFlagsConfig, FeatureFlagAuditEvent, FlattenedFeatureFlag };
