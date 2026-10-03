import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/user-management.ts", import.meta.url), "utf8");
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
const { importUsers, validateUser } = module.exports;
const header = "user_name,email,user_id,password,role\r\n";

test("downloadable CSV imports all three roles with blank passwords", () => {
  const users = importUsers(readFileSync(new URL("../public/samples/users.csv", import.meta.url), "utf8"), []);
  assert.equal(users.length, 3);
  assert.equal(users.map((user) => user.role).join(","), "technician,book_keeper,store_manager");
  assert.ok(users.every((user) => user.password === ""));
});

test("CSV supports BOM, quoted commas, escaped quotes, CRLF and reordered headers", () => {
  const csv = '\uFEFFrole,user_id,password,email,user_name\r\nTECHNICIAN,t-1,,Alex@example.com,"Alex, ""AJ"" Taylor"\r\n';
  const [user] = importUsers(csv, []);
  assert.equal(user.userName, 'Alex, "AJ" Taylor');
  assert.equal(user.email, "alex@example.com");
  assert.equal(user.role, "technician");
});

test("duplicate emails or IDs reject the whole batch without altering existing users", () => {
  const existing = [validateUser({ userName: "Alex", email: "alex@example.com", userId: "t-1", role: "technician" }, [])];
  const before = JSON.stringify(existing);
  assert.throws(() => importUsers(header + "Other,ALEX@example.com,t-2,,technician", existing), /Email already exists/);
  assert.throws(() => importUsers(header + "Other,other@example.com,T-1,,technician", existing), /User ID already exists/);
  assert.throws(() => importUsers(header + "One,one@example.com,t-2,,technician\r\nTwo,one@example.com,t-3,,store_manager", existing), /CSV record 3/);
  assert.equal(JSON.stringify(existing), before);
});

test("bad roles, invalid emails, missing fields and malformed CSV are rejected", () => {
  for (const row of ["Alex,alex@example.com,t-1,,owner", "Alex,invalid,t-1,,technician", ",alex@example.com,t-1,,technician", "Alex,alex@example.com,,,technician"]) {
    assert.throws(() => importUsers(header + row, []));
  }
  assert.throws(() => importUsers("name,email\nAlex,alex@example.com", []), /Required columns/);
  assert.throws(() => importUsers(header + '"Unclosed', []), /unclosed quote/);
  assert.throws(() => importUsers(header + '"Alex"oops,alex@example.com,t-1,,technician', []), /Unexpected content/);
  assert.throws(() => importUsers(header + "Alex,alex@example.com,t-1,technician", []), /Column count/);
  assert.throws(() => importUsers(header + Array.from({ length: 501 }, (_, i) => `User ${i},user${i}@example.com,t-${i},,technician`).join("\n"), []), /500 users/);
});
