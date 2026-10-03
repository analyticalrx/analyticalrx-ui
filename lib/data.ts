import type { Role, Workflow } from "./types";

export const roleLabels: Record<Role, string> = {
  owner: "Owner",
  bookkeeper: "Bookkeeper",
  technician: "Technician",
  store_manager: "Store manager",
  pharmacist: "Pharmacist",
  compliance_admin: "Compliance admin",
  business_development: "Business development",
  tenant_admin: "Tenant admin",
  internal_platform_admin: "Platform admin",
};

export const workflows: Workflow[] = [
  {
    id: "license-expiry",
    name: "License expiry guard",
    summary: "Finds licenses nearing expiration and routes a weekly owner digest.",
    category: "Compliance",
    status: "active",
    lastRun: "12 min ago",
    runCount: 148,
    steps: [
      { id: "le-1", type: "trigger", title: "Every Monday at 08:30", detail: "Timezone: America/New_York" },
      { id: "le-2", type: "search", title: "Find expiring licenses", detail: "Expiration date is within 60 days" },
      { id: "le-3", type: "loop", title: "For each pharmacy", detail: "Group records by store and owner" },
      { id: "le-4", type: "email", title: "Send compliance digest", detail: "Owner, compliance lead, and store manager" },
    ],
  },
  {
    id: "task-generator",
    name: "Scheduled task generator",
    summary: "Creates operational tasks from reusable templates for every active store.",
    category: "Operations",
    status: "active",
    lastRun: "2 hr ago",
    runCount: 864,
    steps: [
      { id: "tg-1", type: "trigger", title: "Every day at 06:00", detail: "Runs once per active store" },
      { id: "tg-2", type: "search", title: "Find active templates", detail: "Status is Active and next run is today" },
      { id: "tg-3", type: "loop", title: "Repeat for each template", detail: "Resolve responsible role and due date" },
      { id: "tg-4", type: "create", title: "Create assigned task", detail: "Include store, assignee, priority, and evidence rule" },
    ],
  },
  {
    id: "kpi-scorecard",
    name: "KPI scorecard sync",
    summary: "Normalizes financial and prescription metrics into the monthly scorecard.",
    category: "Finance",
    status: "attention",
    lastRun: "Failed 34 min ago",
    runCount: 326,
    steps: [
      { id: "ks-1", type: "trigger", title: "When financial period closes", detail: "Event: financial_period.closed" },
      { id: "ks-2", type: "search", title: "Resolve store targets", detail: "Match store, month, and KPI type" },
      { id: "ks-3", type: "update", title: "Upsert KPI scorecard", detail: "Idempotency key: store + period + KPI" },
    ],
  },
  {
    id: "doctor-follow-up",
    name: "Doctor office follow-up",
    summary: "Notifies the assigned representative when a clinical follow-up is due.",
    category: "Clinical",
    status: "draft",
    lastRun: "Never run",
    runCount: 0,
    steps: [
      { id: "df-1", type: "trigger", title: "When follow-up date arrives", detail: "Next follow-up equals current business day" },
      { id: "df-2", type: "search", title: "Find assigned representative", detail: "Resolve territory and account owner" },
      { id: "df-3", type: "email", title: "Send secure reminder", detail: "No protected health information in message" },
    ],
  },
];

