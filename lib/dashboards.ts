import type { Role } from "@/lib/types";

export type ValueType = "number" | "currency" | "text";
export interface DashboardColumn { key: string; label: string; type?: ValueType }
export interface DashboardCard {
  title: string; field?: string; type?: ValueType; help: string;
  countStatus?: string; distinct?: string;
}
export interface DashboardRow { id: string; entity: string; date: string; status: string; values: Record<string, string | number> }
export interface DashboardSpec {
  title: string; description: string; entityLabel: string; scope: string;
  cards: DashboardCard[]; chartTitle: string; chartField: string; chartType?: ValueType;
  tableTitle: string; columns: DashboardColumn[];
  upcoming: { title: string; reason: string }[];
  samples: { entity: string; status: string; values: Record<string, string | number> }[];
}

const number = (key: string, label: string): DashboardColumn => ({ key, label, type: "number" });
const money = (key: string, label: string): DashboardColumn => ({ key, label, type: "currency" });
const card = (title: string, field: string, help: string, type: ValueType = "number"): DashboardCard => ({ title, field, help, type });
const unavailable = (title: string, help: string): DashboardCard => ({ title, help });
const pharmacyNames = ["Sample Pharmacy A", "Sample Pharmacy B", "Sample Pharmacy C", "Sample Pharmacy D"];

// Synthetic UI fixtures only. No dashboard APIs are currently connected.
// Table/field provenance and metric grain are documented in docs/role-dashboard-data-plan.md.
export const dashboardSpecs: Record<Role, DashboardSpec> = {
  owner: {
    title: "Portfolio intelligence", description: "Compare pharmacy activity, recorded payments, and source quality across your organization.", entityLabel: "Pharmacy", scope: "Your tenant portfolio",
    cards: [card("Event activity", "events", "Canonical event activity; not a count of prescriptions filled."), card("Recorded payments", "paid", "Payment summary; not recognized revenue.", "currency"), card("Rejection events", "rejected", "Observed rejection activity."), unavailable("Gross profit", "Acquisition costs and financial periods are not connected.")],
    chartTitle: "Event activity by pharmacy", chartField: "events", tableTitle: "Pharmacy comparison",
    columns: [number("events", "Events"), money("paid", "Recorded payments"), number("rejected", "Rejections"), number("review", "Needs review")],
    upcoming: [{ title: "KPI targets and variance", reason: "Store targets and validated KPI actuals are needed." }, { title: "Portfolio tasks and compliance", reason: "Task assignments, licenses, and compliance obligations are not connected." }, { title: "Profit and EBITDA", reason: "COGS, DIR fees, payroll, rent, and operating expenses are needed." }],
    samples: pharmacyNames.map((entity, i) => ({ entity, status: i === 3 ? "Needs review" : "Partial", values: { events: [542, 418, 631, 307][i], paid: [42810.55, 31590, 48320.25, 22370.5][i], rejected: [12, 8, 5, 19][i], review: [7, 3, 2, 14][i] } })),
  },
  store_manager: {
    title: "Store operations", description: "Review activity and operational exceptions for your assigned pharmacies.", entityLabel: "Pharmacy", scope: "Assigned pharmacies only",
    cards: [card("Event activity", "events", "Activity within assigned pharmacies."), card("Pickup events", "pickups", "Observed pickup activity."), card("Rejection events", "rejected", "Review rejected claim activity."), card("Needs review", "review", "Records with incomplete or inconsistent source data.")],
    chartTitle: "Review workload by pharmacy", chartField: "review", tableTitle: "Store activity and exceptions",
    columns: [number("events", "Events"), number("pickups", "Pickups"), number("rejected", "Rejections"), number("review", "Needs review")],
    upcoming: [{ title: "Staff workload and overdue tasks", reason: "Assigned tasks and due dates are not connected." }, { title: "Inventory exceptions", reason: "Inventory balances and stock feeds are needed." }],
    samples: pharmacyNames.slice(0, 2).map((entity, i) => ({ entity, status: "Needs review", values: { events: [224, 187][i], pickups: [68, 54][i], rejected: [7, 5][i], review: [11, 6][i] } })),
  },
  pharmacist: {
    title: "Pharmacist workbench", description: "Monitor verification activity and work states within your assigned pharmacies.", entityLabel: "Pharmacy", scope: "Assigned pharmacies only",
    cards: [card("Verification pending", "pending", "Requires a validated current work-state projection."), card("Verification events", "verified", "Observed verification events; not actions performed in this UI."), card("Rejected claim events", "rejected", "Rejected claim activity."), unavailable("Upcoming refills", "A validated refill queue and readiness rules are needed.")],
    chartTitle: "Pending verification by pharmacy", chartField: "pending", tableTitle: "Verification and claim summary",
    columns: [number("pending", "Pending verification"), number("verified", "Verification events"), number("rejected", "Rejection events")],
    upcoming: [{ title: "Daily refill queue", reason: "Refill readiness, planned dates, assignments, and blockers are not connected." }, { title: "Clinical verification actions", reason: "Clinical actions require backend workflow support and pharmacy policy." }],
    samples: pharmacyNames.slice(0, 2).map((entity, i) => ({ entity, status: "Partial", values: { pending: [18, 9][i], verified: [44, 32][i], rejected: [7, 4][i] } })),
  },
  technician: {
    title: "My operations workspace", description: "See operational work states and fulfillment activity in your assigned pharmacies.", entityLabel: "Pharmacy", scope: "Assigned pharmacies only",
    cards: [card("Ready work", "ready", "Readiness depends on validated source status mappings."), card("Blocked work", "blocked", "Work-state summary; not an assigned task count."), card("Pickup activity", "pickups", "Recorded pickup events."), unavailable("My assigned tasks", "Task assignments and due dates are not connected.")],
    chartTitle: "Work ready by pharmacy", chartField: "ready", tableTitle: "Fulfillment status summary",
    columns: [number("ready", "Ready"), number("blocked", "Blocked"), number("pickups", "Pickup events")],
    upcoming: [{ title: "Due and overdue tasks", reason: "Your task assignments, priorities, and due dates are needed." }, { title: "Fridge logs and SOP acknowledgments", reason: "Compliance log and training records are not connected." }],
    samples: [{ entity: pharmacyNames[0], status: "Partial", values: { ready: 32, blocked: 5, pickups: 81 } }],
  },
  bookkeeper: {
    title: "Financial command center", description: "Review recorded payments, payer summaries, and missing financial data.", entityLabel: "Pharmacy", scope: "Authorized tenant finance",
    cards: [card("Recorded paid amount", "paid", "Recorded payments; not accounting revenue.", "currency"), card("Recorded billed amount", "billed", "Billed amounts require reconciliation.", "currency"), card("Missing payment data", "missing", "Financial records awaiting enrichment."), unavailable("EBITDA", "Accounting periods and operating costs are not connected.")],
    chartTitle: "Recorded payments by pharmacy", chartField: "paid", chartType: "currency", tableTitle: "Payer payment summary",
    columns: [{ key: "payer", label: "Payer" }, { key: "paymentType", label: "Payment type" }, money("billed", "Billed"), money("paid", "Paid"), number("missing", "Missing data")],
    upcoming: [{ title: "AR aging and deposits", reason: "Receivable aging, settlements, and deposit matching are needed." }, { title: "Monthly close and margins", reason: "Period revenue, acquisition costs, DIR fees, and expense data are not connected." }],
    samples: pharmacyNames.slice(0, 3).map((entity, i) => ({ entity, status: "Partial", values: { payer: ["Example Plan A", "Example Plan B", "Cash / no payer"][i], paymentType: i === 2 ? "Cash" : "Insurance", billed: [20420.25, 18050, 9820][i], paid: [18790.5, 16420.75, 9820][i], missing: [11, 7, 0][i] } })),
  },
  compliance_admin: {
    title: "Compliance and source health", description: "Track processing quality, privacy checks, and safe retention summaries.", entityLabel: "Pharmacy", scope: "Authorized tenant compliance",
    cards: [card("Events processed", "processed", "Processed source records."), card("Events failed", "failed", "Failures are not automatically retryable."), card("Needs enrichment", "enrichment", "Source records with incomplete data."), unavailable("Expired archives", "A retention summary is needed; a due date does not prove deletion.")],
    chartTitle: "Failed events by pharmacy", chartField: "failed", tableTitle: "Pipeline health summary",
    columns: [number("processed", "Processed"), number("failed", "Failed"), number("enrichment", "Enrichment needed"), number("privacyFailures", "Privacy check failures")],
    upcoming: [{ title: "License and document renewals", reason: "License, document, and obligation records are not connected." }, { title: "Retention and access audit", reason: "Approved retention aggregates and sanitized audit summaries are needed." }],
    samples: pharmacyNames.slice(0, 3).map((entity, i) => ({ entity, status: i === 2 ? "Needs review" : "Partial", values: { processed: [524, 378, 692][i], failed: [4, 2, 8][i], enrichment: [18, 11, 24][i], privacyFailures: [0, 0, 1][i] } })),
  },
  business_development: {
    title: "Growth and doctor relationships", description: "Explore safe prescriber activity while preparing for the Doctor CRM workspace.", entityLabel: "Pharmacy", scope: "Assigned outreach scope",
    cards: [{ title: "Known prescribers", distinct: "prescriber", help: "Prescribers with known identifiers and qualifying activity." }, card("Qualifying fill activity", "fills", "Distinct scoped fill activity; not every lifecycle event."), card("Missing prescriber data", "missing", "Activity without a known prescriber."), unavailable("Follow-ups due", "Doctor offices, visits, and representative assignments are not connected.")],
    chartTitle: "Qualifying activity by pharmacy", chartField: "fills", tableTitle: "Safe prescriber activity",
    columns: [{ key: "prescriber", label: "Sample prescriber" }, number("fills", "Qualifying fills"), number("missing", "Missing prescriber")],
    upcoming: [{ title: "Doctor office CRM", reason: "Office records, NPI mappings, relationship stages, and representatives are needed." }, { title: "Visits, pitches, and follow-ups", reason: "Visit history, outcomes, and next actions are not connected." }],
    samples: pharmacyNames.slice(0, 3).map((entity, i) => ({ entity, status: "Partial", values: { prescriber: ["Example Prescriber A", "Example Prescriber B", "Example Prescriber C"][i], fills: [87, 54, 42][i], missing: [6, 4, 2][i] } })),
  },
  tenant_admin: {
    title: "Tenant administration", description: "Review users, role assignments, pharmacy access, and administrative changes.", entityLabel: "Pharmacy", scope: "Your tenant only",
    cards: [{ title: "Active users", countStatus: "Active", help: "Users with active accounts." }, card("Role assignments", "roleCount", "Assigned customer roles."), { title: "Invited users", countStatus: "Invited", help: "Accounts awaiting activation." }, unavailable("Recent access changes", "Current permission audit history is not connected.")],
    chartTitle: "Assigned pharmacy access", chartField: "pharmacyCount", tableTitle: "Tenant users and access",
    columns: [{ key: "name", label: "User" }, { key: "email", label: "Email" }, { key: "role", label: "Role" }, number("pharmacyCount", "Pharmacies")],
    upcoming: [{ title: "Permission change history", reason: "Sanitized role and permission audit records are needed." }, { title: "Tenant configuration", reason: "Settings and assignment changes require backend administration APIs." }],
    samples: [{ entity: pharmacyNames[0], status: "Active", values: { name: "Example Technician", email: "technician@example.com", role: "TECHNICIAN", roleCount: 1, pharmacyCount: 1 } }, { entity: pharmacyNames[1], status: "Active", values: { name: "Example Manager", email: "manager@example.com", role: "STORE_MANAGER", roleCount: 1, pharmacyCount: 2 } }, { entity: pharmacyNames[0], status: "Invited", values: { name: "Example Bookkeeper", email: "finance@example.com", role: "BOOKKEEPER", roleCount: 1, pharmacyCount: 0 } }],
  },
  internal_platform_admin: {
    title: "Platform administration", description: "Review tenant registry status and onboarding across the platform.", entityLabel: "Tenant", scope: "Platform metadata only",
    cards: [{ title: "Tenants", distinct: "entity", help: "Tenant registry records." }, { title: "Active tenants", countStatus: "Active", help: "Active tenant registry entries." }, { title: "Onboarding", countStatus: "Onboarding", help: "Tenants still being prepared." }, unavailable("Platform access failures", "An approved platform audit aggregate is needed.")],
    chartTitle: "Tenant registry status", chartField: "registered", tableTitle: "Tenant registry",
    columns: [{ key: "tenantKey", label: "Public tenant key" }, { key: "name", label: "Organization" }, { key: "mapping", label: "Setup readiness" }],
    upcoming: [{ title: "Platform access audit", reason: "Platform audit access needs explicit backend permissions." }, { title: "Tenant onboarding actions", reason: "Tenant provisioning and status changes require backend support." }],
    samples: [{ entity: "Sample Tenant A", status: "Active", values: { registered: 1, tenantKey: "example-group-a", name: "Example Pharmacy Group A", mapping: "Ready" } }, { entity: "Sample Tenant B", status: "Onboarding", values: { registered: 1, tenantKey: "example-group-b", name: "Example Pharmacy Group B", mapping: "Pending review" } }, { entity: "Sample Tenant C", status: "Inactive", values: { registered: 1, tenantKey: "example-group-c", name: "Example Pharmacy Group C", mapping: "Inactive" } }],
  },
};

export function sampleRows(role: Role, endDate: string): DashboardRow[] {
  const anchor = new Date(`${endDate}T12:00:00Z`);
  return dashboardSpecs[role].samples.map((sample, index) => {
    const day = new Date(anchor);
    day.setUTCDate(day.getUTCDate() - index * 3);
    return { ...sample, id: `${role}-sample-${index}`, date: day.toISOString().slice(0, 10) };
  });
}

export interface DashboardFilters { startDate: string; endDate: string; entity: string; status: string; search: string }
export function filterRows(rows: DashboardRow[], filters: DashboardFilters): DashboardRow[] {
  return rows.filter((row) => row.date >= filters.startDate && row.date <= filters.endDate
    && (filters.entity === "all" || row.entity === filters.entity)
    && (filters.status === "all" || row.status === filters.status)
    && `${row.entity} ${row.status} ${Object.values(row.values).join(" ")}`.toLowerCase().includes(filters.search.trim().toLowerCase()));
}

export function cardValue(card: DashboardCard, rows: DashboardRow[]): number | null {
  if (card.countStatus) return rows.filter((row) => row.status === card.countStatus).length;
  if (card.distinct) return new Set(rows.map((row) => card.distinct === "entity" ? row.entity : row.values[card.distinct!]).filter((value) => value !== undefined && value !== "")).size;
  if (!card.field) return null;
  const values = rows.map((row) => row.values[card.field!]);
  if (values.some((value) => typeof value !== "number")) return null;
  return values.reduce<number>((sum, value) => sum + (value as number), 0);
}

export function formatValue(value: string | number | null | undefined, type?: ValueType): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return type === "currency" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value) : value.toLocaleString("en-US");
}
