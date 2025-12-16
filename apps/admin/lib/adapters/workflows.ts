export type WorkflowStepNode = {
  step_id: string;
  name?: string;
  type?: string;
  description?: string;
  on_success?: string;
  on_failure?: string;
  timeout_minutes?: number;
  raw: any;
};

export type WorkflowGraph = {
  workflowKey: string;
  enabled: boolean;
  steps: WorkflowStepNode[];
  edges: { from: string; to: string; type: "success" | "failure" }[];
};

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function workflowToGraph({
  workflowKey,
  workflow,
}: {
  workflowKey: string;
  workflow: any;
}): WorkflowGraph {
  const stepsRaw = Array.isArray(workflow?.steps) ? workflow.steps : [];
  const steps: WorkflowStepNode[] = stepsRaw
    .filter(isPlainObject)
    .map((s) => ({
      step_id: String(s.step_id ?? ""),
      name: typeof s.name === "string" ? s.name : undefined,
      type: typeof s.type === "string" ? s.type : undefined,
      description: typeof s.description === "string" ? s.description : undefined,
      on_success: typeof s.on_success === "string" ? s.on_success : undefined,
      on_failure: typeof s.on_failure === "string" ? s.on_failure : undefined,
      timeout_minutes:
        typeof s.timeout_minutes === "number" ? s.timeout_minutes : undefined,
      raw: s,
    }))
    .filter((s) => Boolean(s.step_id));

  const edges: WorkflowGraph["edges"] = [];
  for (const step of steps) {
    if (step.on_success) edges.push({ from: step.step_id, to: step.on_success, type: "success" });
    if (step.on_failure) edges.push({ from: step.step_id, to: step.on_failure, type: "failure" });
  }

  return {
    workflowKey,
    enabled: Boolean(workflow?.enabled),
    steps,
    edges,
  };
}

export function workflowsConfigToGraphs(config: any): WorkflowGraph[] {
  const root = config?.workflows;
  if (!isPlainObject(root)) return [];

  const graphs: WorkflowGraph[] = [];
  for (const [workflowKey, workflow] of Object.entries(root)) {
    graphs.push(workflowToGraph({ workflowKey, workflow }));
  }

  return graphs.sort((a, b) => a.workflowKey.localeCompare(b.workflowKey));
}
