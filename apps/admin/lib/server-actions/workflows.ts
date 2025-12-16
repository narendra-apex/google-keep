"use server";

import { getBrandConfigSection, updateBrandConfigSection } from "@/lib/server-actions/brands";

export type WorkflowConfig = {
  schema_version?: string;
  workflows?: Record<
    string,
    {
      enabled?: boolean;
      steps?: any[];
    }
  >;
};

export async function getWorkflowsConfig({
  brandId,
}: {
  brandId: string;
}): Promise<WorkflowConfig> {
  return await getBrandConfigSection<WorkflowConfig>({ brandId, section: "workflows" });
}

export async function updateWorkflowsConfig({
  brandId,
  value,
}: {
  brandId: string;
  value: WorkflowConfig;
}): Promise<WorkflowConfig> {
  return await updateBrandConfigSection<WorkflowConfig>({
    brandId,
    section: "workflows",
    value,
  });
}
