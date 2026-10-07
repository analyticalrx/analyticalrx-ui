import { test, expect } from "@playwright/test";

const roles = ["owner", "bookkeeper", "technician", "store_manager", "pharmacist", "compliance_admin", "business_development", "tenant_admin", "internal_platform_admin"];
const creators = ["owner", "bookkeeper", "store_manager", "pharmacist", "business_development"];
const denied = ["compliance_admin", "tenant_admin", "internal_platform_admin"];
const pharmacies = [{ pharmacyKey: "PHARM-001", displayName: "Central Pharmacy" }, { pharmacyKey: "PHARM-002", displayName: "Riverside Pharmacy" }];
const baseTask = { id: 1, title: "Review the refill queue", description: "Review the queue and record the outcome.\nKeep the team updated.", pharmacyKey: "PHARM-001", status: "TODO", priority: "HIGH", dueAt: "2020-10-08T11:30:00Z", assigneeUserId: 42, createdByUserId: 42, createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-01T09:00:00Z", completedAt: null };

async function fixture(page, options = {}) {
  const state = { tasks: [{ ...baseTask }, { ...baseTask, id: 2, title: "Prepare the weekly stock check", pharmacyKey: "PHARM-002", assigneeUserId: 99, priority: "LOW", status: "BLOCKED", dueAt: null }], comments: [], requests: [], listFailures: options.listFailures ?? 0, conflict: options.conflict ?? false };
  await page.addInitScript(() => sessionStorage.setItem("analyticalrx_access_token", "task-browser-fixture"));
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const role = page.url().split("/").at(-1) || "owner";
    const permissions = options.permissions ?? (denied.includes(role) ? [] : ["task.read", "task.update", "task.comment", ...(creators.includes(role) ? ["task.create"] : [])]);
    if (path === "/api/auth/session") return route.fulfill({ json: { user: { userId: "42", displayName: "Alexandra Pharmacy Administrator", role, roles, tenantId: "1", expiresAt: Math.floor(Date.now()/1000)+1800 } } });
    if (!["/api/me", "/api/pharmacies"].includes(path) && !path.startsWith("/api/tasks")) return route.continue();
    expect(request.headers().authorization).toBe("Bearer task-browser-fixture");
    state.requests.push({ path, method: request.method(), query: Object.fromEntries(url.searchParams), body: request.postDataJSON() });
    if (path === "/api/me") return route.fulfill({ json: { user: { id: 42, displayName: "Alexandra Pharmacy Administrator" }, tenantId: 1, roles: [role.toUpperCase()], permissions, pharmacyKeys: pharmacies.map(p => p.pharmacyKey) } });
    if (path === "/api/pharmacies") return route.fulfill({ json: options.emptyPharmacies ? [] : pharmacies });
    if (path === "/api/tasks" && request.method() === "GET") {
      if (state.listFailures-- > 0) return route.fulfill({ status: 502, json: { error: "Cannot reach the task service. Try again shortly." } });
      if (options.expired) return route.fulfill({ status: 401, json: { error: "Your session has expired." } });
      return route.fulfill({ json: state.tasks.filter(task => (!url.searchParams.get("pharmacyKey") || task.pharmacyKey === url.searchParams.get("pharmacyKey")) && (!url.searchParams.get("status") || task.status === url.searchParams.get("status"))) });
    }
    if (path === "/api/tasks" && request.method() === "POST") {
      const input = request.postDataJSON();
      const task = { ...baseTask, ...input, id: 3, createdByUserId: 42, status: "TODO", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      state.tasks.push(task); return route.fulfill({ status: 201, json: task });
    }
    const id = Number(path.split("/")[3]), task = state.tasks.find(task => task.id === id);
    if (!task) return route.fulfill({ status: 404, json: { error: "This task is no longer available to you." } });
    if (path.endsWith("/status")) {
      if (state.conflict) {
        task.status = "COMPLETED"; task.completedAt = new Date().toISOString(); state.conflict = false;
        return route.fulfill({ status: 409, json: { error: "This task is already closed. Refresh its details before continuing." } });
      }
      task.status = request.postDataJSON().status; task.updatedAt = new Date().toISOString();
      if (task.status === "COMPLETED") task.completedAt = new Date().toISOString();
      return route.fulfill({ json: task });
    }
    if (path.endsWith("/comments")) {
      if (request.method() === "POST") {
        const comment = { id: state.comments.length+1, taskId: id, authorUserId: 42, commentText: request.postDataJSON().commentText, createdAt: new Date().toISOString() };
        state.comments.push(comment); return route.fulfill({ status: 201, json: comment });
      }
      return route.fulfill({ json: state.comments.filter(comment => comment.taskId === id) });
    }
    return route.fulfill({ json: task });
  });
  return state;
}

async function tasksScreen(page, role = "owner") {
  await page.goto(`/${role}`);
  await expect(page.locator(".role-dashboard h1")).toBeVisible();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.locator(".task-management h1")).toHaveText("Tasks");
  await expect(page.getByText("Checking your task access…")).toHaveCount(0);
}
async function noOverflow(page) {
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function widths(page) {
  for (const [width, height] of [[320,568], [390,844], [844,390], [768,1024], [1024,768], [1100,800], [1440,900], [1920,1080]]) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
  }
}

test("Tasks is available in every role and actions follow current backend permissions", async ({ page }) => {
  const state = await fixture(page);
  for (const role of roles) {
    await tasksScreen(page, role);
    if (denied.includes(role)) {
      await expect(page.getByRole("heading", { name: "Task access is not enabled" })).toBeVisible();
      await expect(page.locator(".task-list-item")).toHaveCount(0);
    } else {
      await expect(page.locator(".task-list-item")).toHaveCount(2);
      await expect(page.getByRole("button", { name: "+ New task", exact: true })).toHaveCount(creators.includes(role) ? 1 : 0);
    }
    await noOverflow(page);
  }
  expect(state.requests.filter(request => request.path === "/api/tasks" && request.method === "GET")).toHaveLength(6);
});

test("tasks support server filters, local search and assignments without overflow", async ({ page }, testInfo) => {
  const state = await fixture(page);
  await tasksScreen(page);
  await expect(page.locator(".task-list-item")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("tasks-list.png"), fullPage: true });
  await page.getByRole("combobox", { name: "Pharmacy", exact: true }).selectOption("PHARM-002");
  await expect(page.locator(".task-list-item")).toHaveCount(1);
  expect(state.requests.at(-1).query.pharmacyKey).toBe("PHARM-002");
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("BLOCKED");
  await expect.poll(() => state.requests.at(-1).query.status).toBe("BLOCKED");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".task-list-item")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Assignment", exact: true }).selectOption("mine");
  await expect(page.locator(".task-list-item")).toHaveCount(1);
  await page.getByLabel("Search loaded tasks").fill("not-a-task");
  await expect(page.getByRole("heading", { name: "No matching tasks" })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".task-list-item")).toHaveCount(2);
  await widths(page);
});

test("create, open, change status and comment use all six task APIs", async ({ page }, testInfo) => {
  const initialViewport = page.viewportSize();
  const state = await fixture(page);
  await tasksScreen(page);
  await page.getByRole("button", { name: "+ New task", exact: true }).click();
  await page.getByLabel("Task title", { exact: true }).fill("Review inventory and record the team's progress");
  await page.getByLabel("Description", { exact: false }).fill("Review the stock count.\nShare discrepancies with the manager.");
  await page.getByRole("combobox", { name: "Pharmacy", exact: true }).selectOption("PHARM-001");
  await page.getByRole("combobox", { name: "Priority", exact: true }).selectOption("URGENT");
  await page.getByRole("button", { name: "Assign to me" }).click();
  await page.getByLabel("Due date and time", { exact: false }).fill("2026-10-08T11:30");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("task-create.png"), fullPage: true });
  await widths(page);
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Task details", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review inventory and record the team's progress" })).toBeVisible();
  const create = state.requests.find(request => request.method === "POST" && request.path === "/api/tasks");
  expect(create.body.assigneeUserId).toBe(42);
  expect(create.body.priority).toBe("URGENT");
  expect(create.body.dueAt).toBe(await page.evaluate(() => new Date("2026-10-08T11:30").toISOString()));
  await page.setViewportSize(initialViewport);
  await page.getByRole("combobox", { name: "Task status", exact: true }).selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.locator(".task-detail-top .task-badge")).toHaveText("In progress");
  await page.getByLabel("Add a comment", { exact: true }).fill("Count completed.\nAwaiting manager review.");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(page.locator(".task-comments li")).toHaveCount(1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("task-details.png"), fullPage: true });
  await widths(page);
  await page.getByRole("combobox", { name: "Task status", exact: true }).selectOption("COMPLETED");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("This task is closed. Its status can no longer be changed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save status" })).toHaveCount(0);
  await page.getByRole("button", { name: "← Back to tasks" }).click();
  await expect(page.locator(".task-list-item")).toHaveCount(3);
  for (const [method, path] of [["GET","/api/tasks"], ["POST","/api/tasks"], ["GET","/api/tasks/3"], ["PATCH","/api/tasks/3/status"], ["GET","/api/tasks/3/comments"], ["POST","/api/tasks/3/comments"]]) expect(state.requests.some(request => request.method === method && request.path === path)).toBe(true);
});

test("read-only access, unavailable pharmacies and retry states remain usable", async ({ page }) => {
  await fixture(page, { permissions: ["task.read"], listFailures: 1, emptyPharmacies: true });
  await tasksScreen(page);
  await expect(page.locator(".task-management").getByRole("alert")).toContainText("Cannot reach the task service");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".task-list-item")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "+ New task", exact: true })).toHaveCount(0);
  await page.locator(".task-list-item").first().click();
  await expect(page.getByText("Your account has read-only access to this conversation.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save status" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add comment", exact: true })).toHaveCount(0);
  await widths(page);
});

test("closed-task conflicts refresh details without losing the actionable error", async ({ page }) => {
  const state = await fixture(page, { conflict: true });
  await tasksScreen(page);
  await expect(page.locator(".task-list-item")).toHaveCount(2);
  await page.locator(".task-list-item").first().click();
  await page.getByRole("combobox", { name: "Task status", exact: true }).selectOption("BLOCKED");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.locator(".task-management").getByRole("alert")).toContainText("already closed");
  await expect(page.locator(".task-detail-top .task-badge")).toHaveText("Completed");
  await expect(page.getByRole("button", { name: "Save status" })).toHaveCount(0);
  expect(state.requests.filter(request => request.path === "/api/tasks/1" && request.method === "GET")).toHaveLength(2);
});

test("expired API sessions return to login and discard the tab token", async ({ page }) => {
  await fixture(page, { expired: true });
  await page.goto("/owner");
  await expect(page.locator(".role-dashboard h1")).toBeVisible();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("analyticalrx_access_token"))).toBeNull();
});
