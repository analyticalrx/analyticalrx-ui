import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  let source;
  try { source = readFileSync(new URL(`../${path}.ts`, import.meta.url), "utf8"); }
  catch { source = readFileSync(new URL(`../${path}.tsx`, import.meta.url), "utf8"); }
  const module = { exports: {} };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, Date, Intl, require: (name) => name.startsWith("@/") ? load(name.slice(2)) : require(name) });
  cache.set(path, module.exports); return module.exports;
}
const { dashboardSpecs, sampleRows, filterRows, cardValue } = load("lib/dashboards");
const { supportedRoles } = load("lib/types");
const { RoleDashboard } = load("components/role-dashboard");
const filters = { startDate: "2026-09-01", endDate: "2026-10-03", entity: "all", status: "all", search: "" };

test("all nine roles render distinct dashboards without default fabricated metrics", () => {
  assert.equal(supportedRoles.length, 9);
  const titles = new Set();
  for (const role of supportedRoles) {
    const spec = dashboardSpecs[role];
    titles.add(spec.title);
    const html = renderToStaticMarkup(React.createElement(RoleDashboard, { role, tenantId: "42" }));
    assert.ok(html.includes(spec.title));
    assert.ok(html.includes("Dashboard data is not connected"));
    assert.ok(html.includes("Show sample data"));
    assert.ok(html.includes("Unavailable"));
    assert.ok(!html.includes("Sample Pharmacy A"));
    assert.equal(spec.cards.length, 4);
  }
  assert.equal(titles.size, 9);
});

test("sample data filters apply date, pharmacy, status and search together", () => {
  const rows = sampleRows("owner", "2026-10-03");
  assert.equal(filterRows(rows, filters).length, 4);
  assert.equal(filterRows(rows, { ...filters, entity: rows[0].entity }).length, 1);
  assert.equal(filterRows(rows, { ...filters, status: "Needs review" }).length, 1);
  assert.equal(filterRows(rows, { ...filters, startDate: "2026-10-01" }).length, 1);
  assert.equal(filterRows(rows, { ...filters, search: "no match" }).length, 0);
});

test("financial card totals match filtered samples and unavailable metrics stay null", () => {
  const rows = sampleRows("bookkeeper", "2026-10-03");
  const cards = dashboardSpecs.bookkeeper.cards;
  assert.equal(cardValue(cards[0], rows), 45031.25);
  assert.equal(cardValue(cards[0], [rows[0]]), 18790.5);
  assert.equal(cardValue(cards[3], rows), null);
  assert.equal(cardValue(cards[0], []), 0);
  assert.equal(cardValue(cards[0], [{ ...rows[0], values: {} }]), null);
});

test("operations and platform layouts omit ungranted financial or patient fields", () => {
  for (const role of ["technician", "pharmacist", "internal_platform_admin"]) {
    const spec = dashboardSpecs[role];
    assert.ok(spec.columns.every((column) => column.type !== "currency"));
    for (const row of sampleRows(role, "2026-10-03")) {
      assert.ok(!Object.keys(row.values).some((key) => /password|patient|rx_no|refill_no|schema_name/.test(key)));
    }
  }
});
