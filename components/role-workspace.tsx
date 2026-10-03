"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PharmacyOS } from "@/components/pharmacy-os";
import type { Role } from "@/lib/types";
import { canAccessRole } from "@/lib/auth/types";

export function RoleWorkspace({ role }: { role: Role }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!canAccessRole(user, role)) router.replace(`/${user.role}`);
  }, [loading, user, role, router]);
  if (loading || !user || !canAccessRole(user, role)) {
    return <main className="auth-page"><p role="status">Loading your workspace…</p></main>;
  }
  return <PharmacyOS key={`${user.tenantId}-${user.userId}-${role}`} role={role} allowedRoles={user.roles ?? [user.role]} userName={user.displayName} tenantId={user.tenantId} onLogout={logout} />;
}
