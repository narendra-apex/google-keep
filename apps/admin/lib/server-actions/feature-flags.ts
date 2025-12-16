"use server";

import { getBrandConfigSection, updateBrandConfigSection } from "@/lib/server-actions/brands";

export type FeatureFlagsConfig = {
  schema_version?: string;
  flags?: Record<string, any>;
};

export async function getFeatureFlagsConfig({
  brandId,
}: {
  brandId: string;
}): Promise<FeatureFlagsConfig> {
  return await getBrandConfigSection<FeatureFlagsConfig>({
    brandId,
    section: "feature-flags",
  });
}

export async function updateFeatureFlagsConfig({
  brandId,
  value,
}: {
  brandId: string;
  value: FeatureFlagsConfig;
}): Promise<FeatureFlagsConfig> {
  return await updateBrandConfigSection<FeatureFlagsConfig>({
    brandId,
    section: "feature-flags",
    value,
  });
}

export type FeatureFlagAuditEvent = {
  id: string;
  flagKeyPath: string;
  actor: string;
  action: string;
  at: string;
};

export async function getFeatureFlagAuditTrail({
  flagKeyPath,
}: {
  flagKeyPath: string;
}): Promise<{ data: FeatureFlagAuditEvent[] }> {
  return {
    data: [
      {
        id: "evt-001",
        flagKeyPath,
        actor: "admin@acme.com",
        action: "updated rollout",
        at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        id: "evt-002",
        flagKeyPath,
        actor: "ops@acme.com",
        action: "toggled enabled",
        at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      },
    ],
  };
}
