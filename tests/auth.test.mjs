import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as jose from "jose";

const require = createRequire(import.meta.url);
const { NextResponse } = require("next/server");
const key = new Uint8Array(64).fill(17);
const cache = new Map();

// Exercise the actual TypeScript server modules without starting Next.js or a database.
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const source = readFileSync(new URL(`../${path}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, process, Buffer, URL, TextEncoder, AbortSignal,
    fetch: (...args) => globalThis.fetch(...args),
    require: (name) => name === "server-only" ? {} : name === "jose" ? jose
      : name === "next/server" ? { NextResponse } : name.startsWith("@/") ? load(name.slice(2)) : require(name),
  }, { filename: path });
  cache.set(path, module.exports);
  return module.exports;
}

process.env.JWT_SIGNING_SECRET = Buffer.from(key).toString("base64");
process.env.AUTH_JWT_ISSUER = "analyticalrx-api";
process.env.AUTH_JWT_AUDIENCE = "analyticalrx-frontend";
process.env.AUTH_JWT_SECRET_ENCODING = "base64";
delete process.env.AUTH_JWKS_URL;
delete process.env.AUTH_ROLE_CLAIM;
delete process.env.AUTH_NAME_CLAIM;
const auth = load("lib/auth/session");
const sessionRoute = load("app/api/auth/session/route");
const loginRoute = load("app/api/auth/login/route");

async function token(roles = ["OWNER"], overrides = {}, signingKey = key, algorithm = "HS512") {
  return new jose.SignJWT({ roles, display_name: "Test User", ...overrides })
    .setProtectedHeader({ alg: algorithm }).setSubject("42")
    .setIssuer("analyticalrx-api").setAudience("analyticalrx-frontend")
    .setIssuedAt().setExpirationTime("30m").sign(signingKey);
}

test("verifies backend Base64 key, HS512, uppercase roles and display name", async () => {
  for (const role of ["OWNER", "BOOKKEEPER", "TECHNICIAN", "STORE_MANAGER", "PHARMACIST", "COMPLIANCE_ADMIN", "BUSINESS_DEVELOPMENT", "TENANT_ADMIN", "INTERNAL_PLATFORM_ADMIN"]) {
    const user = await auth.verifyAccessToken(await token([role]));
    assert.equal(user.role, role.toLowerCase());
    assert.equal(user.displayName, "Test User");
    assert.equal(user.userId, "42");
    assert.ok(user.expiresAt > Date.now() / 1000);
  }
  assert.equal((await auth.verifyAccessToken(await token(["TECHNICIAN", "OWNER"]))).role, "owner");
  for (const algorithm of ["HS256", "HS384"]) {
    assert.equal((await auth.verifyAccessToken(await token(["OWNER"], {}, key, algorithm))).role, "owner");
  }
});

test("rejects invalid signature, issuer, audience, expired and missing-expiry tokens", async () => {
  await assert.rejects(auth.verifyAccessToken(await token(["OWNER"], {}, new Uint8Array(64).fill(99))));
  for (const payload of [
    { sub: "42", roles: ["OWNER"], iss: "wrong", aud: "analyticalrx-frontend", exp: 9999999999 },
    { sub: "42", roles: ["OWNER"], iss: "analyticalrx-api", aud: "wrong", exp: 9999999999 },
    { sub: "42", roles: ["OWNER"], iss: "analyticalrx-api", aud: "analyticalrx-frontend", exp: 1 },
    { sub: "42", roles: ["OWNER"], iss: "analyticalrx-api", aud: "analyticalrx-frontend" },
  ]) {
    const jwt = await new jose.SignJWT(payload).setProtectedHeader({ alg: "HS512" }).setIssuedAt().sign(key);
    await assert.rejects(auth.verifyAccessToken(jwt));
  }
});

test("session endpoint requires bearer auth and denies unsupported roles", async () => {
  assert.equal((await sessionRoute.GET(new Request("http://localhost/api/auth/session"))).status, 401);
  const unsupported = await token(["UNKNOWN_ROLE"]);
  assert.equal((await sessionRoute.GET(new Request("http://localhost/api/auth/session", { headers: { Authorization: `Bearer ${unsupported}` } }))).status, 403);
  const valid = await sessionRoute.GET(new Request("http://localhost/api/auth/session", { headers: { Authorization: `Bearer ${await token(["BOOKKEEPER"])}` } }));
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("Cache-Control"), "no-store");
  assert.equal((await valid.json()).user.role, "bookkeeper");
});

test("login forwards credentials and uses verified JWT role rather than response user role", async () => {
  const original = globalThis.fetch;
  const jwt = await token(["TECHNICIAN"]);
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, "/api/v1/auth/login");
    assert.deepEqual(JSON.parse(options.body), { email: "test@example.com", password: "password", tenantKey: "analyticalrx-dev" });
    return Response.json({ accessToken: jwt, tokenType: "Bearer", user: { role: "OWNER" } });
  };
  try {
    const response = await loginRoute.POST(new Request("http://localhost/api/auth/login", {
      method: "POST", body: JSON.stringify({ email: " test@example.com ", password: "password", tenantKey: " analyticalrx-dev " }),
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.role, "technician");
  } finally { globalThis.fetch = original; }
});

test("login handles invalid credentials, service failures and malformed input", async () => {
  const original = globalThis.fetch;
  const request = () => new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "test@example.com", password: "password", tenantKey: "analyticalrx-dev" }) });
  try {
    globalThis.fetch = async () => new Response(null, { status: 401 });
    assert.equal((await loginRoute.POST(request())).status, 401);
    globalThis.fetch = async () => { throw new Error("Connection refused"); };
    assert.equal((await loginRoute.POST(request())).status, 502);
    assert.equal((await loginRoute.POST(new Request("http://localhost/api/auth/login", { method: "POST", body: "invalid" }))).status, 400);
    globalThis.fetch = async () => Response.json({ accessToken: await token(["UNKNOWN_ROLE"]), tokenType: "Bearer" });
    assert.equal((await loginRoute.POST(request())).status, 403);
  } finally { globalThis.fetch = original; }
});

test("verified multi-role sessions preserve only granted roles", async () => {
  const user = await auth.verifyAccessToken(await token(["OWNER", "PHARMACIST", "UNKNOWN_ROLE", "OWNER"]));
  assert.equal(user.roles.join(","), "owner,pharmacist");
  const { canAccessRole } = load("lib/auth/types");
  assert.equal(canAccessRole(user, "pharmacist"), true);
  assert.equal(canAccessRole(user, "internal_platform_admin"), false);
});

test("login rejects missing, blank or non-string tenant keys before calling backend", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { assert.fail("Invalid tenant key must not reach backend"); };
  try {
    for (const tenantKey of [undefined, "", "   ", 123]) {
      const response = await loginRoute.POST(new Request("http://localhost/api/auth/login", {
        method: "POST", body: JSON.stringify({ email: "test@example.com", password: "password", tenantKey }),
      }));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, "Enter your tenant key.");
    }
  } finally { globalThis.fetch = original; }
});
