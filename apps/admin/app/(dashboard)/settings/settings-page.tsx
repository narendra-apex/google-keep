"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/lib/rbac";

const profileSchema = z.object({
  tenant_name: z.string().min(1),
  support_email: z.string().email(),
});

const webhookSchema = z.object({
  url: z.string().url(),
  event: z.string().min(1),
});

const procurementSchema = z.object({
  approval_required: z.boolean(),
  default_currency: z.string().min(3).max(3),
});

type Tab = "profile" | "api_keys" | "webhooks" | "procurement";

async function fetchSection(section: Tab) {
  const res = await fetch(`/api/admin/settings?section=${section}`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return await res.json();
}

async function saveSection(section: Tab, value: any) {
  const res = await fetch(`/api/admin/settings?section=${section}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error("Failed to save settings");
  return await res.json();
}

export function SettingsPage() {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("profile");
  const [loading, setLoading] = React.useState(false);
  const [apiKeys, setApiKeys] = React.useState<any[] | null>(null);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { tenant_name: "", support_email: "" },
  });

  const webhookForm = useForm<z.infer<typeof webhookSchema>>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { url: "", event: "order.created" },
  });

  const procurementForm = useForm<z.infer<typeof procurementSchema>>({
    resolver: zodResolver(procurementSchema),
    defaultValues: { approval_required: true, default_currency: "USD" },
  });

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetchSection(tab)
      .then((data) => {
        if (!mounted) return;

        if (tab === "profile") {
          profileForm.reset({
            tenant_name: data.tenant_name ?? data.name ?? "",
            support_email: data.support_email ?? "",
          });
        }

        if (tab === "api_keys") {
          setApiKeys(data.data ?? []);
        }

        if (tab === "procurement") {
          procurementForm.reset({
            approval_required: Boolean(data.approval_required),
            default_currency: data.default_currency ?? "USD",
          });
        }
      })
      .catch(() => {
        toast({ title: "Failed to load settings", variant: "error" });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tab, toast, profileForm, procurementForm]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>
        <div className="flex flex-wrap items-center gap-2">
          {(["profile", "api_keys", "webhooks", "procurement"] as const).map((t) => (
            <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} size="sm">
              {t}
            </Button>
          ))}
        </div>
      </div>

      {loading ? <LoadingState label={`Loading ${tab}`} /> : null}

      {tab === "profile" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={profileForm.handleSubmit(async (values) => {
                try {
                  await saveSection("profile", values);
                  toast({ title: "Saved profile", variant: "success" });
                } catch {
                  toast({ title: "Save failed", variant: "error" });
                }
              })}
            >
              <div className="grid gap-1">
                <Label htmlFor="tenant_name">Tenant name</Label>
                <Input id="tenant_name" {...profileForm.register("tenant_name")} />
                {profileForm.formState.errors.tenant_name ? (
                  <div className="text-xs text-red-600">{profileForm.formState.errors.tenant_name.message}</div>
                ) : null}
              </div>
              <div className="grid gap-1">
                <Label htmlFor="support_email">Support email</Label>
                <Input id="support_email" {...profileForm.register("support_email")} />
                {profileForm.formState.errors.support_email ? (
                  <div className="text-xs text-red-600">{profileForm.formState.errors.support_email.message}</div>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Can scope={"settings.write"}>
                  <Button type="submit">Save</Button>
                </Can>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {tab === "api_keys" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Keys</CardTitle>
          </CardHeader>
          <CardContent>
            {apiKeys === null ? (
              <LoadingState label="Loading keys" />
            ) : apiKeys.length === 0 ? (
              <EmptyState title="No API keys" description="API keys are managed by the Foundation service." />
            ) : (
              <div className="grid gap-2">
                {apiKeys.map((k) => (
                  <div key={k.api_key_id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">{k.name}</div>
                      <div className="text-xs text-muted-foreground">•••• {k.last4}</div>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "webhooks" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={webhookForm.handleSubmit(async (values) => {
                try {
                  await saveSection("webhooks", values);
                  toast({ title: "Webhook saved", variant: "success" });
                  webhookForm.reset({ url: "", event: values.event });
                } catch {
                  toast({ title: "Save failed", variant: "error" });
                }
              })}
            >
              <div className="grid gap-1">
                <Label htmlFor="webhook_url">URL</Label>
                <Input id="webhook_url" placeholder="https://…" {...webhookForm.register("url")} />
                {webhookForm.formState.errors.url ? (
                  <div className="text-xs text-red-600">{webhookForm.formState.errors.url.message}</div>
                ) : null}
              </div>
              <div className="grid gap-1">
                <Label htmlFor="webhook_event">Event</Label>
                <Input id="webhook_event" {...webhookForm.register("event")} />
                {webhookForm.formState.errors.event ? (
                  <div className="text-xs text-red-600">{webhookForm.formState.errors.event.message}</div>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Can scope={"settings.write"}>
                  <Button type="submit">Register</Button>
                </Can>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {tab === "procurement" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procurement Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={procurementForm.handleSubmit(async (values) => {
                try {
                  await saveSection("procurement", values);
                  toast({ title: "Saved procurement preferences", variant: "success" });
                } catch {
                  toast({ title: "Save failed", variant: "error" });
                }
              })}
            >
              <div className="flex items-center gap-2">
                <input
                  id="approval_required"
                  type="checkbox"
                  checked={procurementForm.watch("approval_required")}
                  onChange={(e) => procurementForm.setValue("approval_required", e.target.checked)}
                />
                <Label htmlFor="approval_required">Approval required for POs</Label>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="default_currency">Default currency</Label>
                <Input id="default_currency" {...procurementForm.register("default_currency")} />
                {procurementForm.formState.errors.default_currency ? (
                  <div className="text-xs text-red-600">{procurementForm.formState.errors.default_currency.message}</div>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Can scope={"settings.write"}>
                  <Button type="submit">Save</Button>
                </Can>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
