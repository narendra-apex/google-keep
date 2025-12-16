"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { Modal } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUsers } from "@/lib/hooks/useUsers";
import { Can, useHasScope } from "@/lib/rbac";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
});

function statusBadgeVariant(status: string) {
  if (status === "active") return "success";
  if (status === "invited") return "warning";
  if (status === "disabled") return "destructive";
  return "default";
}

export function UsersPage() {
  const [q, setQ] = React.useState<string>("");
  const [status, setStatus] = React.useState<"all" | "active" | "invited" | "disabled">("all");

  const { usersQuery, rolesQuery, inviteMutation, bulkStatusMutation, updateRolesMutation } =
    useUsers({ q, status });

  const users = usersQuery.data?.data ?? [];

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [rolesDrawerUserId, setRolesDrawerUserId] = React.useState<string | null>(null);
  const rolesDrawerUser = users.find((u) => u.user_id === rolesDrawerUserId) ?? null;

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const canWriteUsers = useHasScope("identity.users.write");
  const canReadRoles = useHasScope("identity.roles.read");
  const canWriteRoles = useHasScope("identity.roles.write");

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", name: "" },
  });

  React.useEffect(() => {
    if (!inviteOpen) form.reset({ email: "", name: "" });
  }, [inviteOpen, form]);

  const roles = rolesQuery.data?.data ?? [];
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!rolesDrawerUser) return;
    setSelectedRoleIds(rolesDrawerUser.roles ?? []);
  }, [rolesDrawerUser]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold md:text-2xl">Users</h1>
        <div className="flex items-center gap-2">
          <Can scope={"identity.users.write"}>
            <Button onClick={() => setInviteOpen(true)}>Invite User</Button>
          </Can>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1">
          <Label htmlFor="q">Search</Label>
          <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email or name" />
        </div>
        <div className="grid gap-1">
          <Label>Status</Label>
          <div className="flex flex-wrap gap-2">
            {(["all", "active", "invited", "disabled"] as const).map((s) => (
              <Button
                key={s}
                variant={status === s ? "default" : "outline"}
                onClick={() => setStatus(s)}
                size="sm"
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-end justify-end">
          <Can scope={"identity.users.write"}>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.length === 0 || bulkStatusMutation.isPending || !canWriteUsers}
                onClick={() => bulkStatusMutation.mutate({ userIds: selectedIds, status: "disabled" })}
              >
                Disable Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.length === 0 || bulkStatusMutation.isPending || !canWriteUsers}
                onClick={() => bulkStatusMutation.mutate({ userIds: selectedIds, status: "active" })}
              >
                Activate Selected
              </Button>
            </div>
          </Can>
        </div>
      </div>

      {usersQuery.isLoading ? <LoadingState label="Loading users" /> : null}

      {usersQuery.isError ? (
        <EmptyState
          title="Failed to load users"
          description="Check your Foundation API configuration or try again."
          action={<Button onClick={() => usersQuery.refetch()}>Retry</Button>}
        />
      ) : null}

      {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 ? (
        <EmptyState
          title="No users"
          description="Invite a user to get started."
          action={
            <Can scope={"identity.users.write"}>
              <Button onClick={() => setInviteOpen(true)}>Invite User</Button>
            </Can>
          }
        />
      ) : null}

      {users.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selectedIds.length > 0 && selectedIds.length === users.length}
                  onChange={(e) => {
                    setSelectedIds(e.target.checked ? users.map((u) => u.user_id) : []);
                  }}
                />
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const checked = selectedIds.includes(u.user_id);
              return (
                <TableRow key={u.user_id} data-state={checked ? "selected" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${u.email}`}
                      checked={checked}
                      onChange={(e) => {
                        setSelectedIds((prev) =>
                          e.target.checked
                            ? Array.from(new Set([...prev, u.user_id]))
                            : prev.filter((id) => id !== u.user_id)
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(u.status)}>{u.status}</Badge>
                  </TableCell>
                  <TableCell>{(u.roles ?? []).join(", ") || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Can scope={"identity.roles.read"}>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canReadRoles}
                          onClick={() => setRolesDrawerUserId(u.user_id)}
                        >
                          Roles
                        </Button>
                      </Can>
                      <Can scope={"identity.users.write"}>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bulkStatusMutation.isPending || !canWriteUsers}
                          onClick={() =>
                            bulkStatusMutation.mutate({
                              userIds: [u.user_id],
                              status: u.status === "disabled" ? "active" : "disabled",
                            })
                          }
                        >
                          {u.status === "disabled" ? "Activate" : "Disable"}
                        </Button>
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}

      <Modal open={inviteOpen} onOpenChange={setInviteOpen} title="Invite user">
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => {
            inviteMutation.mutate(values, {
              onSuccess: () => setInviteOpen(false),
            });
          })}
        >
          <div className="grid gap-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" {...form.register("email")} />
            {form.formState.errors.email ? (
              <div className="text-xs text-red-600">{form.formState.errors.email.message}</div>
            ) : null}
          </div>
          <div className="grid gap-1">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input id="invite-name" {...form.register("name")} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending || !canWriteUsers}>
              {inviteMutation.isPending ? "Sending…" : "Send Invite"}
            </Button>
          </div>
        </form>
      </Modal>

      <Drawer
        open={Boolean(rolesDrawerUser)}
        onOpenChange={(open) => {
          if (!open) setRolesDrawerUserId(null);
        }}
        title={rolesDrawerUser ? `Roles: ${rolesDrawerUser.email}` : "Roles"}
      >
        {!rolesDrawerUser ? null : (
          <div className="flex flex-col gap-4">
            {rolesQuery.isLoading ? <LoadingState label="Loading roles" /> : null}

            {roles.length > 0 ? (
              <div className="grid gap-2">
                {roles.map((r) => {
                  const checked = selectedRoleIds.includes(r.role_id);
                  return (
                    <label key={r.role_id} className="flex items-start gap-2 rounded-md border p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedRoleIds((prev) =>
                            e.target.checked
                              ? Array.from(new Set([...prev, r.role_id]))
                              : prev.filter((id) => id !== r.role_id)
                          );
                        }}
                        disabled={!canWriteRoles}
                      />
                      <div>
                        <div className="text-sm font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(r.scopes ?? []).slice(0, 3).join(", ")}
                          {(r.scopes ?? []).length > 3 ? "…" : ""}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No roles" description="Create roles in Foundation to assign them." />
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setRolesDrawerUserId(null)}>
                Close
              </Button>
              <Can scope={"identity.roles.write"}>
                <Button
                  disabled={updateRolesMutation.isPending || !canWriteRoles}
                  onClick={() => {
                    updateRolesMutation.mutate({ userId: rolesDrawerUser.user_id, roleIds: selectedRoleIds });
                  }}
                >
                  {updateRolesMutation.isPending ? "Saving…" : "Save roles"}
                </Button>
              </Can>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
