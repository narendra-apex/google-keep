"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bulkUpdateUserStatus,
  inviteUser,
  listRoles,
  listUsers,
  updateUserRoles,
  type Role,
  type User,
  type UserStatus,
} from "@/lib/server-actions/users";
import { useToast } from "@/components/ui/toast";

export function useUsers({
  q,
  status = "all",
}: {
  q?: string;
  status?: UserStatus | "all";
} = {}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const usersQuery = useQuery({
    queryKey: ["users", q ?? "", status],
    queryFn: () => listUsers({ q, status }),
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => listRoles(),
    staleTime: 5 * 60 * 1000,
  });

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onMutate: async (vars) => {
      const key = ["users", q ?? "", status] as const;
      await qc.cancelQueries({ queryKey: key });

      const previous = qc.getQueryData<{ data: User[] }>(key);
      const optimistic: User = {
        user_id: `tmp-${Date.now()}`,
        email: vars.email,
        name: vars.name,
        status: "invited",
        roles: [],
      };

      qc.setQueryData<{ data: User[] }>(key, {
        data: [optimistic, ...(previous?.data ?? [])],
      });

      return { previous, key, optimisticId: optimistic.user_id };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData(ctx.key, ctx.previous);
      toast({ title: "Invite failed", description: "Please try again.", variant: "error" });
    },
    onSuccess: (created, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData<{ data: User[] }>(ctx.key, (current) => {
        const data = current?.data ?? [];
        return {
          data: data.map((u) => (u.user_id === ctx.optimisticId ? created : u)),
        };
      });
      toast({ title: "Invitation sent", description: created.email, variant: "success" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: bulkUpdateUserStatus,
    onMutate: async (vars) => {
      const key = ["users", q ?? "", status] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ data: User[] }>(key);
      qc.setQueryData<{ data: User[] }>(key, (current) => {
        const data = current?.data ?? [];
        return {
          data: data.map((u) =>
            vars.userIds.includes(u.user_id) ? { ...u, status: vars.status } : u
          ),
        };
      });
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData(ctx.key, ctx.previous);
      toast({ title: "Update failed", variant: "error" });
    },
    onSuccess: () => {
      toast({ title: "Users updated", variant: "success" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: updateUserRoles,
    onMutate: async (vars) => {
      const key = ["users", q ?? "", status] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ data: User[] }>(key);

      qc.setQueryData<{ data: User[] }>(key, (current) => {
        const data = current?.data ?? [];
        return {
          data: data.map((u) => (u.user_id === vars.userId ? { ...u, roles: vars.roleIds } : u)),
        };
      });

      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData(ctx.key, ctx.previous);
      toast({ title: "Role update failed", variant: "error" });
    },
    onSuccess: () => {
      toast({ title: "Roles updated", variant: "success" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  return {
    usersQuery,
    rolesQuery,
    inviteMutation,
    bulkStatusMutation,
    updateRolesMutation,
  };
}

export type { User, Role, UserStatus };
