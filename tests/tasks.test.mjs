import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as jose from "jose";
const require = createRequire(import.meta.url);
const { NextResponse } = require("next/server");
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const source = readFileSync(new URL(`../${path}.ts`, import.meta.url), "utf8");
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, Buffer, URL, URLSearchParams, TextEncoder, AbortSignal,
    fetch: (...args) => globalThis.fetch(...args),
    require: name => name === "server-only" ? {} : name === "jose" ? jose : name === "next/server" ? { NextResponse } : name.startsWith("@/") ? load(name.slice(2)) : require(name),
  });
  cache.set(path, module.exports); return module.exports;
}
const tasks = load("lib/tasks");
const list = load("app/api/tasks/route");
const detail = load("app/api/tasks/[id]/route");
const status = load("app/api/tasks/[id]/status/route");
const comments = load("app/api/tasks/[id]/comments/route");
const me = load("app/api/me/route");
const pharmacies = load("app/api/pharmacies/route");
const key = new Uint8Array(64).fill(41);
process.env.JWT_SIGNING_SECRET = Buffer.from(key).toString("base64");
process.env.AUTH_JWT_ISSUER = "analyticalrx-api";
process.env.AUTH_JWT_AUDIENCE = "analyticalrx-frontend";
process.env.AUTH_JWT_SECRET_ENCODING = "base64";
delete process.env.AUTH_JWKS_URL;
const token = await new jose.SignJWT({ roles: ["OWNER"] }).setProtectedHeader({ alg: "HS512" }).setSubject("42").setIssuer("analyticalrx-api").setAudience("analyticalrx-frontend").setIssuedAt().setExpirationTime("30m").sign(key);
const request = (path, method = "GET", body) => new Request(`http://localhost${path}`, { method, headers: { Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const ctx = { params: Promise.resolve({ id: "27" }) };
const input = { title: "Review queue", pharmacyKey: "PHARM-001", assigneeUserId: 42 };

test("task validation rejects unsafe IDs, blank content and invalid date/status values", () => {
  assert.equal(tasks.validateCreateTask(input).priority, "MEDIUM");
  assert.equal(tasks.validateCreateTask({ ...input, tenantId: "other", schema: "other" }).tenantId, undefined);
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "42"]) assert.throws(() => tasks.validateCreateTask({ ...input, assigneeUserId: value }));
  for (const value of ["", "   ", "x".repeat(201)]) assert.throws(() => tasks.validateCreateTask({ ...input, title: value }));
  assert.throws(() => tasks.validateCreateTask({ ...input, dueAt: "2026-10-07T12:00" }));
  assert.throws(() => tasks.validateCreateTask({ ...input, description: "x".repeat(4001) }));
  assert.throws(() => tasks.validateStatusChange({ status: "DONE" }));
  assert.throws(() => tasks.validateTaskComment({ commentText: "  " }));
  assert.throws(() => tasks.validateTaskComment({ commentText: "x".repeat(2001) }));
  assert.equal(tasks.validateTaskComment({ commentText: " Update " }).commentText, "Update");
  assert.equal(tasks.isTaskId("9223372036854775807"), true);
  for (const id of ["0", "-1", "../me", "9223372036854775808", "1e3"]) assert.equal(tasks.isTaskId(id), false);
});

test("status actions require effective permissions and the assignee or manager, and lock terminal tasks", () => {
  const context = { user: { id: 42 }, roles: ["TECHNICIAN"], permissions: ["task.read", "task.update"] };
  const task = { status: "TODO", assigneeUserId: 42 };
  assert.equal(tasks.canUpdateTask(context, task), true);
  assert.equal(tasks.canUpdateTask(context, { ...task, assigneeUserId: 99 }), false);
  assert.equal(tasks.canUpdateTask({ ...context, roles: ["OWNER"] }, { ...task, assigneeUserId: 99 }), true);
  assert.equal(tasks.canUpdateTask({ ...context, permissions: ["task.read"] }, task), false);
  for (const status of ["COMPLETED", "SKIPPED", "CANCELED"]) assert.equal(tasks.canUpdateTask(context, { ...task, status }), false);
});

test("all task and context routes require a verified bearer token before contacting the backend", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("Unauthenticated requests must not reach backend");
  try {
    for (const [handler, path, method, body] of [
      [list.GET, "/api/tasks", "GET"], [list.POST, "/api/tasks", "POST", input],
      [detail.GET, "/api/tasks/27", "GET"], [status.PATCH, "/api/tasks/27/status", "PATCH", { status: "IN_PROGRESS" }],
      [comments.GET, "/api/tasks/27/comments", "GET"], [comments.POST, "/api/tasks/27/comments", "POST", { commentText: "Checked" }],
      [me.GET, "/api/me", "GET"], [pharmacies.GET, "/api/pharmacies", "GET"],
    ]) {
      const missing = new Request(`http://localhost${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal((await handler(missing, ctx)).status, 401);
      const invalid = new Request(`http://localhost${path}`, { method, headers: { Authorization: "Bearer invalid" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal((await handler(invalid, ctx)).status, 401);
    }
  } finally { globalThis.fetch = original; }
});

test("task routes forward all six API contracts, bearer headers and supported filters only", async () => {
  const original = globalThis.fetch;
  let actual;
  globalThis.fetch = async (url, options) => {
    actual = { url: new URL(url), options };
    return Response.json(options.method === "POST" ? { id: 27 } : [], { status: options.method === "POST" ? 201 : 200 });
  };
  try {
    const response = await list.GET(request("/api/tasks?pharmacyKey=PHARM%2F1&status=BLOCKED&tenantId=999&schema=other"));
    assert.equal(response.status, 200);
    assert.equal(actual.url.pathname, "/api/v1/tasks");
    assert.equal(actual.url.searchParams.get("pharmacyKey"), "PHARM/1");
    assert.equal(actual.url.searchParams.get("status"), "BLOCKED");
    assert.equal(actual.url.searchParams.has("tenantId"), false);
    assert.equal(actual.url.searchParams.has("schema"), false);
    assert.equal(actual.options.headers.Authorization, `Bearer ${token}`);
    assert.equal(actual.options.redirect, "error");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await list.POST(request("/api/tasks", "POST", { ...input, tenantId: 999 }))).status, 201);
    assert.deepEqual(JSON.parse(actual.options.body), { ...input, description: null, priority: "MEDIUM", dueAt: null });
    for (const [handler, path, method, body, backendPath] of [
      [detail.GET, "/api/tasks/27", "GET", undefined, "/api/v1/tasks/27"],
      [status.PATCH, "/api/tasks/27/status", "PATCH", { status: "BLOCKED", tenantId: 99 }, "/api/v1/tasks/27/status"],
      [comments.GET, "/api/tasks/27/comments", "GET", undefined, "/api/v1/tasks/27/comments"],
      [comments.POST, "/api/tasks/27/comments", "POST", { commentText: " Checked ", tenantId: 99 }, "/api/v1/tasks/27/comments"],
      [me.GET, "/api/me", "GET", undefined, "/api/v1/me"],
      [pharmacies.GET, "/api/pharmacies", "GET", undefined, "/api/v1/pharmacies"],
    ]) {
      await handler(request(path, method, body), ctx);
      assert.equal(actual.url.pathname, backendPath);
      assert.equal(actual.options.method, method);
      if (body) assert.equal(JSON.parse(actual.options.body).tenantId, undefined);
    }
  } finally { globalThis.fetch = original; }
});

test("invalid task requests are rejected before forwarding and backend failures remain actionable", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("Invalid details must not reach backend");
  try {
    assert.equal((await list.GET(request("/api/tasks?status=INVALID"))).status, 400);
    assert.equal((await list.POST(request("/api/tasks", "POST", { ...input, title: " " }))).status, 400);
    assert.equal((await comments.POST(request("/api/tasks/27/comments", "POST", { commentText: " " }), ctx)).status, 400);
    assert.equal((await status.PATCH(request("/api/tasks/27/status", "PATCH", { status: null }), ctx)).status, 400);
    assert.equal((await detail.GET(request("/api/tasks/0"), { params: Promise.resolve({ id: "0" }) })).status, 400);
    for (const code of [400, 401, 403, 404, 409, 429, 500]) {
      globalThis.fetch = async () => Response.json({ message: "private database diagnostic" }, { status: code });
      const response = await status.PATCH(request("/api/tasks/27/status", "PATCH", { status: "COMPLETED" }), ctx);
      assert.equal(response.status, code === 500 ? 502 : code);
      assert.ok(!(await response.json()).error.includes("private database"));
    }
    globalThis.fetch = async () => { throw new Error("timeout"); };
    const response = await list.POST(request("/api/tasks", "POST", input));
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /Refresh before trying again/);
  } finally { globalThis.fetch = original; }
});

test("task data parsing rejects unsafe response IDs rather than silently rounding", () => {
  const task = { id: 1, title: "Review", description: null, pharmacyKey: "PHARM-001", status: "TODO", priority: "MEDIUM", dueAt: null, completedAt: null, assigneeUserId: 42, createdByUserId: 42, createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z" };
  assert.equal(tasks.parseTask(task).id, 1);
  assert.throws(() => tasks.parseTask({ ...task, id: Number.MAX_SAFE_INTEGER + 1 }));
  assert.throws(() => tasks.parseTask({ ...task, status: "unknown" }));
  assert.throws(() => tasks.parseComments([{ id: 1, taskId: 1, authorUserId: 42, commentText: "Hi", createdAt: "invalid" }]));
});
