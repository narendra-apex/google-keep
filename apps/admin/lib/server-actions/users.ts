"use server";

import { foundationFetch } from "@/lib/server-actions/foundation";

export type UserStatus = "active" | "invited" | "disabled";

export type User = {
  user_id: string;
  email: string;
  name?: string;
  status: UserStatus;
  roles?: string[];
};

export type Role = {
  role_id: string;
  name: string;
  description?: string;
  scopes: string[];
};

const MOCK_USERS: User[] = [
  {
    user_id: "user-001",
    email: "admin@acme.com",
    name: "Admin",
    status: "active",
    roles: ["admin"],
  },
  {
    user_id: "user-002",
    email: "ops@acme.com",
    name: "Ops",
    status: "active",
    roles: ["ops"],
  },
  {
    user_id: "user-003",
    email: "invited@acme.com",
    name: "Invited User",
    status: "invited",
    roles: ["viewer"],
  },
];

const MOCK_ROLES: Role[] = [
  {
    role_id: "admin",
    name: "Admin",
    scopes: [
      "identity.users.read",
      "identity.users.write",
      "identity.roles.read",
      "identity.roles.write",
      "brands.config.write",
      "feature_flags.write",
      "workflows.write",
      "settings.write",
    ],
  },
  {
    role_id: "viewer",
    name: "Viewer",
    scopes: ["identity.users.read", "identity.roles.read"],
  },
  {
    role_id: "ops",
    name: "Ops",
    scopes: ["identity.users.read", "identity.users.write", "identity.roles.read"],
  },
];

export async function listUsers({
  q,
  status,
}: {
  q?: string;
  status?: UserStatus | "all";
} = {}): Promise<{ data: User[] }> {
  try {
    const res = await foundationFetch<{ data: User[] }>("/users", {
      query: { q, status: status === "all" ? undefined : status },
      cache: "no-store",
    });

    if (Array.isArray((res as any).data)) return res;
    const arr = Array.isArray(res as any) ? (res as any) : [];
    return { data: arr };
  } catch {
    let data = MOCK_USERS;
    if (status && status !== "all") data = data.filter((u) => u.status === status);
    if (q) {
      const needle = q.toLowerCase();
      data = data.filter(
        (u) => u.email.toLowerCase().includes(needle) || (u.name ?? "").toLowerCase().includes(needle)
      );
    }

    return { data };
  }
}

export async function inviteUser({
  email,
  name,
}: {
  email: string;
  name?: string;
}): Promise<User> {
  try {
    return await foundationFetch<User>("/users", {
      method: "POST",
      body: { email, name },
    });
  } catch {
    return {
      user_id: `tmp-${Date.now()}`,
      email,
      name,
      status: "invited",
      roles: [],
    };
  }
}

export async function listRoles(): Promise<{ data: Role[] }> {
  try {
    const res = await foundationFetch<{ data: Role[] }>("/roles", { cache: "no-store" });
    if (Array.isArray((res as any).data)) return res;
    const arr = Array.isArray(res as any) ? (res as any) : [];
    return { data: arr };
  } catch {
    return { data: MOCK_ROLES };
  }
}

export async function updateUserRoles({
  userId,
  roleIds,
}: {
  userId: string;
  roleIds: string[];
}): Promise<User> {
  try {
    return await foundationFetch<User>(`/users/${userId}/roles`, {
      method: "PUT",
      body: { roles: roleIds },
    });
  } catch {
    const user = MOCK_USERS.find((u) => u.user_id === userId);
    return {
      ...(user ?? { user_id: userId, email: "unknown@example.com", status: "active" as const }),
      roles: roleIds,
    };
  }
}

export async function bulkUpdateUserStatus({
  userIds,
  status,
}: {
  userIds: string[];
  status: Exclude<UserStatus, "invited">;
}): Promise<{ updated: string[] }> {
  try {
    return await foundationFetch<{ updated: string[] }>("/users/bulk/status", {
      method: "PATCH",
      body: { user_ids: userIds, status },
    });
  } catch {
    return { updated: userIds };
  }
}
