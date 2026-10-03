import { notFound } from "next/navigation";
import { RoleWorkspace } from "@/components/role-workspace";
import { normalizeRole } from "@/lib/auth/types";

export default async function RolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role: requested } = await params;
  const role = normalizeRole(requested);
  if (!role || role !== requested) notFound();
  return <RoleWorkspace role={role} />;
}
