export const taskStatuses = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "SKIPPED", "CANCELED"] as const;
export const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskStatus = typeof taskStatuses[number];
export type TaskPriority = typeof taskPriorities[number];
export const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: "To do", IN_PROGRESS: "In progress", BLOCKED: "Blocked",
  COMPLETED: "Completed", SKIPPED: "Skipped", CANCELED: "Canceled",
};
export const taskPriorityLabels: Record<TaskPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

export interface Task {
  id: number; pharmacyKey: string; title: string; description: string | null;
  status: TaskStatus; priority: TaskPriority; dueAt: string | null;
  assigneeUserId: number; createdByUserId: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
}
export interface TaskComment { id: number; taskId: number; authorUserId: number; commentText: string; createdAt: string; }
export interface TaskContext {
  user: { id: number; displayName: string }; tenantId: number;
  roles: string[]; permissions: string[]; pharmacyKeys: string[];
}
export interface TaskPharmacy { pharmacyKey: string; displayName: string; }
export interface CreateTaskInput {
  title: string; description: string | null; pharmacyKey: string;
  assigneeUserId: number; priority: TaskPriority; dueAt: string | null;
}

export function isTaskStatus(value: unknown): value is TaskStatus { return taskStatuses.includes(value as TaskStatus); }
export function isTaskPriority(value: unknown): value is TaskPriority { return taskPriorities.includes(value as TaskPriority); }
export function isSafeId(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
export function isTaskId(value: string): boolean {
  return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt("9223372036854775807");
}
export function isClosedTask(status: TaskStatus): boolean { return ["COMPLETED", "SKIPPED", "CANCELED"].includes(status); }
export function canUpdateTask(context: TaskContext, task: Task): boolean {
  return context.permissions.includes("task.update") && !isClosedTask(task.status)
    && (task.assigneeUserId === context.user.id || context.roles.includes("OWNER") || context.roles.includes("STORE_MANAGER"));
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter valid task details.");
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters.`);
  return value.trim();
}
export function validateCreateTask(value: unknown): CreateTaskInput {
  const input = object(value);
  const title = text(input.title, "Task title", 200);
  const pharmacyKey = text(input.pharmacyKey, "Pharmacy", 200);
  if (!isSafeId(input.assigneeUserId)) throw new Error("Enter a valid positive assignee user ID.");
  if (input.description != null && (typeof input.description !== "string" || input.description.length > 4000)) throw new Error("Description must be 4000 characters or fewer.");
  const priority = input.priority ?? "MEDIUM";
  if (!isTaskPriority(priority)) throw new Error("Choose a valid priority.");
  const dueAt = input.dueAt ?? null;
  if (dueAt !== null && (typeof dueAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(dueAt) || !Number.isFinite(Date.parse(dueAt)))) throw new Error("Choose a valid due date and time.");
  return { title, pharmacyKey, assigneeUserId: input.assigneeUserId, description: typeof input.description === "string" ? input.description.trim() || null : null, priority, dueAt };
}
export function validateStatusChange(value: unknown): { status: TaskStatus } {
  const input = object(value);
  if (!isTaskStatus(input.status)) throw new Error("Choose a valid task status.");
  return { status: input.status };
}
export function validateTaskComment(value: unknown): { commentText: string } {
  return { commentText: text(object(value).commentText, "Comment", 2000) };
}
export function dueDateToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Choose a valid due date and time.");
  return date.toISOString();
}
export function isOverdueTask(task: Task): boolean { return !isClosedTask(task.status) && !!task.dueAt && Date.parse(task.dueAt) < Date.now(); }
export function formatTaskDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
}
export function parseTask(value: unknown): Task {
  const row = object(value);
  if (!isSafeId(row.id) || !isSafeId(row.assigneeUserId) || !isSafeId(row.createdByUserId)
    || typeof row.title !== "string" || typeof row.pharmacyKey !== "string"
    || !isTaskStatus(row.status) || !isTaskPriority(row.priority)
    || (row.description !== null && typeof row.description !== "string")
    || ![row.createdAt, row.updatedAt].every((date) => typeof date === "string" && Number.isFinite(Date.parse(date)))
    || ![row.dueAt, row.completedAt].every((date) => date === null || typeof date === "string" && Number.isFinite(Date.parse(date)))) {
    throw new Error("The task service returned invalid details. Refresh and try again.");
  }
  return row as unknown as Task;
}
export function parseComments(value: unknown): TaskComment[] {
  if (!Array.isArray(value)) throw new Error("Comments could not be loaded. Try again.");
  return value.map((value) => {
    const row = object(value);
    if (!isSafeId(row.id) || !isSafeId(row.taskId) || !isSafeId(row.authorUserId) || typeof row.commentText !== "string" || typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))) throw new Error("The task service returned invalid comments. Try again.");
    return row as unknown as TaskComment;
  });
}
export function parseTaskContext(value: unknown): TaskContext {
  const row = object(value), user = object(row.user);
  if (!isSafeId(user.id) || typeof user.displayName !== "string" || !isSafeId(row.tenantId)
    || ![row.roles, row.permissions, row.pharmacyKeys].every((list) => Array.isArray(list) && list.every((item) => typeof item === "string"))) throw new Error("Your task access could not be verified. Try again.");
  return row as unknown as TaskContext;
}
export function parsePharmacies(value: unknown): TaskPharmacy[] {
  if (!Array.isArray(value) || value.some((row) => !row || typeof row.pharmacyKey !== "string" || typeof row.displayName !== "string")) throw new Error("Pharmacies could not be loaded. Try again.");
  return value;
}
