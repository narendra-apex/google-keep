"use client";

import * as React from "react";

export type Scope = string;

type StoredScopes = {
  scopes: Scope[];
};

function readScopesFromCookie(): Scope[] {
  if (typeof document === "undefined") return [];
  const cookies = document.cookie
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);

  const scopeCookie = cookies.find((c) => c.startsWith("scopes="));
  if (!scopeCookie) return [];

  const raw = decodeURIComponent(scopeCookie.split("=").slice(1).join("="));
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readScopesFromStorage(): Scope[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem("rbac_scopes");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredScopes | Scope[];
    if (Array.isArray(parsed)) return parsed;
    return parsed.scopes ?? [];
  } catch {
    return [];
  }
}

export function useScopes(): Scope[] {
  const [scopes, setScopes] = React.useState<Scope[]>([]);

  React.useEffect(() => {
    const next = Array.from(new Set([...readScopesFromCookie(), ...readScopesFromStorage()]));
    setScopes(next);
  }, []);

  return scopes;
}

export function useHasScope(required: Scope | Scope[]): boolean {
  const scopes = useScopes();
  const req = Array.isArray(required) ? required : [required];
  return req.every((s) => scopes.includes(s));
}

export function Can({
  scope,
  children,
  fallback = null,
}: {
  scope: Scope | Scope[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = useHasScope(scope);
  return <>{allowed ? children : fallback}</>;
}
