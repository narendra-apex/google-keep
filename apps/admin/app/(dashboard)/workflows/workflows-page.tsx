"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Stepper } from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/lib/rbac";
import { workflowsConfigToGraphs } from "@/lib/adapters/workflows";
import { getWorkflowsConfig, updateWorkflowsConfig, type WorkflowConfig } from "@/lib/server-actions/workflows";

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

export function WorkflowsPage() {
  const brandId = getCookie("brand_id") ?? "brand-uuid-001";
  const qc = useQueryClient();
  const { toast } = useToast();

  const workflowsQuery = useQuery({
    queryKey: ["workflows-config", brandId],
    queryFn: () => getWorkflowsConfig({ brandId }),
  });

  const [draft, setDraft] = React.useState<WorkflowConfig | null>(null);

  React.useEffect(() => {
    if (workflowsQuery.data) setDraft(workflowsQuery.data);
  }, [workflowsQuery.data]);

  const graphs = workflowsConfigToGraphs(draft);
  const [selectedWorkflowKey, setSelectedWorkflowKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedWorkflowKey) return;
    if (graphs.length > 0) setSelectedWorkflowKey(graphs[0].workflowKey);
  }, [graphs, selectedWorkflowKey]);

  const graph = graphs.find((g) => g.workflowKey === selectedWorkflowKey) ?? null;

  const [selectedStepId, setSelectedStepId] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (!graph) return;
    setSelectedStepId(graph.steps[0]?.step_id);
  }, [graph?.workflowKey]);

  const selectedStep = graph?.steps.find((s) => s.step_id === selectedStepId) ?? null;

  const saveMutation = useMutation({
    mutationFn: (value: WorkflowConfig) => updateWorkflowsConfig({ brandId, value }),
    onMutate: async (value) => {
      const key = ["workflows-config", brandId] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<WorkflowConfig>(key);
      qc.setQueryData(key, value);
      return { previous, key };
    },
    onError: (_err, _value, ctx) => {
      if (!ctx) return;
      qc.setQueryData(ctx.key, ctx.previous);
      toast({ title: "Save failed", variant: "error" });
    },
    onSuccess: () => {
      toast({ title: "Workflows saved", variant: "success" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["workflows-config", brandId] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Workflows</h1>
        <Can scope={"workflows.write"}>
          <Button
            disabled={!draft || saveMutation.isPending}
            onClick={() => {
              if (!draft) return;
              saveMutation.mutate(draft);
            }}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </Can>
      </div>

      {workflowsQuery.isLoading ? <LoadingState label="Loading workflow config" /> : null}

      {workflowsQuery.isError ? (
        <EmptyState
          title="Failed to load workflows"
          description="Check brand config endpoints (/brands/{id}/config/workflows)."
          action={<Button onClick={() => workflowsQuery.refetch()}>Retry</Button>}
        />
      ) : null}

      {!workflowsQuery.isLoading && !workflowsQuery.isError && graphs.length === 0 ? (
        <EmptyState
          title="No workflows"
          description="Workflows are loaded from the brand metadata schema example or brand config endpoint."
        />
      ) : null}

      {graph ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflows</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {graphs.map((g) => (
                <Button
                  key={g.workflowKey}
                  variant={g.workflowKey === selectedWorkflowKey ? "default" : "outline"}
                  onClick={() => setSelectedWorkflowKey(g.workflowKey)}
                >
                  {g.workflowKey}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <Stepper
                steps={graph.steps.map((s) => ({
                  id: s.step_id,
                  title: s.name ?? s.step_id,
                  description: s.type,
                }))}
                activeStepId={selectedStepId}
                onSelect={setSelectedStepId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step Inspector</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {selectedStep ? (
                <>
                  <div className="text-sm font-medium">{selectedStep.name ?? selectedStep.step_id}</div>
                  <Textarea
                    className="font-mono text-xs"
                    value={JSON.stringify(selectedStep.raw, null, 2)}
                    onChange={(e) => {
                      if (!draft || !selectedWorkflowKey) return;
                      try {
                        const nextRaw = JSON.parse(e.target.value);
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const next: WorkflowConfig = JSON.parse(JSON.stringify(prev));
                          const wf = next.workflows?.[selectedWorkflowKey];
                          if (!wf || !Array.isArray(wf.steps)) return next;
                          const idx = wf.steps.findIndex((s: any) => s.step_id === selectedStep.step_id);
                          if (idx >= 0) wf.steps[idx] = nextRaw;
                          return next;
                        });
                      } catch {
                        // allow invalid JSON in editor until fixed
                      }
                    }}
                  />
                  <div className="text-xs text-muted-foreground">
                    Designer view is derived from the JSON. Edit the JSON for advanced configuration.
                  </div>
                </>
              ) : (
                <EmptyState title="Select a step" />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
