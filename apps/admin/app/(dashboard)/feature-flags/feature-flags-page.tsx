"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timeline } from "@/components/ui/timeline";
import { Toggle } from "@/components/ui/toggle";
import { Can } from "@/lib/rbac";
import { useFeatureFlags, useFeatureFlagAuditTrailQuery } from "@/lib/hooks/useFeatureFlags";

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

export function FeatureFlagsPage() {
  const brandId = getCookie("brand_id") ?? "brand-uuid-001";
  const { configQuery, flags, updateFlagMutation } = useFeatureFlags({ brandId });

  const [selectedKeyPath, setSelectedKeyPath] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (selectedKeyPath) return;
    if (flags.length > 0) setSelectedKeyPath(flags[0].keyPath);
  }, [flags, selectedKeyPath]);

  const auditQuery = useFeatureFlagAuditTrailQuery(selectedKeyPath);

  const auditItems = (auditQuery.data?.data ?? []).map((e) => ({
    id: e.id,
    title: `${e.actor} ${e.action}`,
    description: e.flagKeyPath,
    timestamp: new Date(e.at).toLocaleString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Feature Flags</h1>
        <div className="text-xs text-muted-foreground">Brand: {brandId}</div>
      </div>

      {configQuery.isLoading ? <LoadingState label="Loading feature flags" /> : null}

      {configQuery.isError ? (
        <EmptyState
          title="Failed to load feature flags"
          description="Check brand config endpoints (/brands/{id}/config/feature-flags)."
          action={<Button onClick={() => configQuery.refetch()}>Retry</Button>}
        />
      ) : null}

      {!configQuery.isLoading && !configQuery.isError && flags.length === 0 ? (
        <EmptyState
          title="No feature flags"
          description="Feature flags are loaded from the brand metadata schema example or brand config endpoint."
        />
      ) : null}

      {flags.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead className="w-[90px]">Enabled</TableHead>
                    <TableHead className="w-[140px]">Rollout %</TableHead>
                    <TableHead className="w-[190px]">Schedule start</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((f) => {
                    const scheduledStart = f.scheduled_rollout?.start_date ?? "";
                    return (
                      <TableRow
                        key={f.keyPath}
                        data-state={selectedKeyPath === f.keyPath ? "selected" : undefined}
                        onClick={() => setSelectedKeyPath(f.keyPath)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-medium">{f.keyPath}</TableCell>
                        <TableCell>
                          <Can scope={"feature_flags.write"} fallback={<Toggle checked={f.enabled} onCheckedChange={() => {}} disabled />}>
                            <Toggle
                              checked={f.enabled}
                              onCheckedChange={(checked) => {
                                updateFlagMutation.mutate({ keyPath: f.keyPath, patch: { enabled: checked } });
                              }}
                            />
                          </Can>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={f.rollout_percentage ?? 0}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              updateFlagMutation.mutate({
                                keyPath: f.keyPath,
                                patch: { rollout_percentage: Number.isFinite(value) ? value : 0 },
                              });
                            }}
                            disabled={updateFlagMutation.isPending}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={scheduledStart}
                            onChange={(e) => {
                              updateFlagMutation.mutate({
                                keyPath: f.keyPath,
                                patch: { scheduled_rollout: { ...(f.scheduled_rollout ?? {}), start_date: e.target.value } },
                              });
                            }}
                            disabled={updateFlagMutation.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-2 text-xs text-muted-foreground">
                Rollout and scheduling changes are persisted via PATCH /brands/{{brand_id}}/config/feature-flags.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedKeyPath ? (
                auditQuery.isLoading ? (
                  <LoadingState label="Loading audit" />
                ) : auditItems.length === 0 ? (
                  <EmptyState title="No audit events" />
                ) : (
                  <Timeline items={auditItems} />
                )
              ) : (
                <EmptyState title="Select a flag" />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
