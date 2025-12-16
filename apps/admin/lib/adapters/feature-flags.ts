export type FlattenedFeatureFlag = {
  keyPath: string;
  enabled: boolean;
  rollout_percentage?: number;
  description?: string;
  scheduled_rollout?: any;
  raw: any;
};

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function flattenFeatureFlags(config: any): FlattenedFeatureFlag[] {
  const flagsRoot = config?.flags;
  if (!isPlainObject(flagsRoot)) return [];

  const out: FlattenedFeatureFlag[] = [];

  for (const [domain, domainFlags] of Object.entries(flagsRoot)) {
    if (!isPlainObject(domainFlags)) continue;

    for (const [flagKey, flagValue] of Object.entries(domainFlags)) {
      if (!isPlainObject(flagValue)) continue;

      out.push({
        keyPath: `${domain}.${flagKey}`,
        enabled: Boolean(flagValue.enabled),
        rollout_percentage:
          typeof flagValue.rollout_percentage === "number"
            ? flagValue.rollout_percentage
            : undefined,
        description: typeof flagValue.description === "string" ? flagValue.description : undefined,
        scheduled_rollout: flagValue.scheduled_rollout,
        raw: flagValue,
      });
    }
  }

  return out.sort((a, b) => a.keyPath.localeCompare(b.keyPath));
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function setFeatureFlagInConfig({
  config,
  keyPath,
  patch,
}: {
  config: any;
  keyPath: string;
  patch: Partial<{ enabled: boolean; rollout_percentage: number; scheduled_rollout: any }>;
}) {
  const next = deepClone(config ?? {});
  if (!next.flags) next.flags = {};

  const [domain, key] = keyPath.split(".");
  if (!domain || !key) return next;

  if (!next.flags[domain]) next.flags[domain] = {};
  const existing = next.flags[domain][key] ?? {};

  next.flags[domain][key] = {
    ...existing,
    ...patch,
  };

  return next;
}
