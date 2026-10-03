import { supportedRoles, type Role } from "@/lib/types";

export interface AuthSession {
  userId: string;
  displayName: string;
  role: Role;
  roles: Role[];
  storeId?: string;
  expiresAt: number;
  tenantId?: string;
}

// Explicit precedence makes multi-role tokens independent of claim ordering.
export function normalizeRoles(value: unknown): Role[] {
  const roles = (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase());
  return supportedRoles.filter((role) => roles.includes(role));
}

export function normalizeRole(value: unknown): Role | null { return normalizeRoles(value)[0] ?? null; }

export function canAccessRole(user: AuthSession, role: Role): boolean {
  return (user.roles ?? [user.role]).includes(role);
}
