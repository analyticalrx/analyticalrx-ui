export const supportedRoles = ["owner", "bookkeeper", "technician", "store_manager", "pharmacist", "compliance_admin", "business_development", "tenant_admin", "internal_platform_admin"] as const;
export type Role = typeof supportedRoles[number];
export type Section = "overview" | "workflows" | "users" | "tasks";
export type WorkflowStatus = "active" | "draft" | "attention";
export type WorkflowStepType = "trigger" | "search" | "loop" | "create" | "email" | "update";

export interface Metric {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "steady";
  tone: "blue" | "green" | "amber" | "rose";
}

export interface StorePerformance {
  id: string;
  name: string;
  region: string;
  revenue: number;
  prescriptions: number;
  vaccines: number;
  tasksDue: number;
  compliance: number;
  status: "On track" | "Watch" | "Off track";
}

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  title: string;
  detail: string;
}

export interface Workflow {
  id: string;
  name: string;
  summary: string;
  category: "Compliance" | "Operations" | "Finance" | "Clinical";
  status: WorkflowStatus;
  lastRun: string;
  runCount: number;
  steps: WorkflowStep[];
}
