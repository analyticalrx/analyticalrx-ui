"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cardValue, dashboardSpecs, filterRows, formatValue, sampleRows, type DashboardRow } from "@/lib/dashboards";
import { roleLabels } from "@/lib/data";
import type { Role } from "@/lib/types";

export function RoleDashboard({ role, tenantId }: { role: Role; tenantId?: string }) {
  const spec = dashboardSpecs[role];
  const [anchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(() => {
    const date = new Date(); date.setUTCDate(date.getUTCDate() - 29); return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(anchor);
  const [preview, setPreview] = useState(false);
  const [entity, setEntity] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date-desc");
  const [selected, setSelected] = useState<DashboardRow | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const samples = useMemo(() => sampleRows(role, anchor), [role, anchor]);
  const invalidDates = !startDate || !endDate || startDate > endDate;
  const rows = useMemo(() => {
    const filtered = preview && !invalidDates ? filterRows(samples, { startDate, endDate, entity, status, search }) : [];
    return [...filtered].sort((a, b) => sort === "name-asc" ? String(a.values.name ?? a.entity).localeCompare(String(b.values.name ?? b.entity)) : b.date.localeCompare(a.date));
  }, [preview, invalidDates, samples, startDate, endDate, entity, status, search, sort]);
  const chartRows = useMemo(() => {
    const groups = new Map<string, number>();
    for (const row of rows) {
      const label = role === "tenant_admin" ? String(row.values.name) : role === "internal_platform_admin" ? row.status : row.entity;
      const value = row.values[spec.chartField];
      if (typeof value === "number") groups.set(label, (groups.get(label) ?? 0) + value);
    }
    return [...groups].sort((a, b) => b[1] - a[1]);
  }, [rows, role, spec.chartField]);
  const chartMax = Math.max(1, ...chartRows.map(([, value]) => value));

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    else if (!selected && dialog.current?.open) dialog.current?.close();
  }, [selected]);

  function chooseRange(days: number) {
    const start = new Date(`${anchor}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - days + 1);
    setStartDate(start.toISOString().slice(0, 10)); setEndDate(anchor);
  }
  function resetFilters() {
    chooseRange(30); setEntity("all"); setStatus("all"); setSearch(""); setSort("date-desc");
  }

  return <div className="page-content role-dashboard">
    <section className="page-heading"><div><span className="eyebrow">{roleLabels[role]} dashboard</span><h1>{spec.title}</h1><p>{spec.description}</p></div><span className="dashboard-scope">{spec.scope}{tenantId && role !== "internal_platform_admin" && <small>Tenant {tenantId}</small>}</span></section>
    <div className={`dashboard-notice ${preview ? "sample" : ""}`}>
      <div><b>{preview ? "Sample data preview" : "Dashboard data is not connected"}</b><p>{preview ? "These fictional records help you explore the dashboard. They do not represent your tenant or pharmacy assignments." : "Your workspace is ready. Metrics will appear when the dashboard data is connected."}</p></div>
      <button type="button" className="dashboard-secondary" aria-pressed={preview} onClick={() => { setPreview(!preview); setSelected(null); }}>{preview ? "Hide sample data" : "Show sample data"}</button>
    </div>
    <section className="dashboard-filters" aria-label="Dashboard filters">
      <label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label>End date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <label>{preview ? "Sample " : ""}{spec.entityLabel.toLowerCase()}<select value={entity} disabled={!preview} onChange={(event) => setEntity(event.target.value)}><option value="all">{preview ? `All sample ${spec.entityLabel.toLowerCase()}s` : "Not connected"}</option>{preview && [...new Set(samples.map((row) => row.entity))].map((name) => <option key={name}>{name}</option>)}</select></label>
      <label>Status<select value={status} disabled={!preview} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{[...new Set(samples.map((row) => row.status))].map((value) => <option key={value}>{value}</option>)}</select></label>
      <div className="dashboard-presets"><button type="button" onClick={() => chooseRange(7)}>Last 7 days</button><button type="button" onClick={() => chooseRange(30)}>Last 30 days</button><button type="button" onClick={resetFilters}>Reset</button></div>
    </section>
    {invalidDates && <div className="login-error" role="alert">Choose valid start and end dates. The end date must be on or after the start date.</div>}
    <div className="dashboard-freshness"><span><i className={preview ? "sample" : ""} />{preview ? "Fictional data · not live" : "Freshness unavailable"}</span><span>{rows.length} {preview ? "sample records match" : "live records loaded"}</span></div>
    <section className="metric-grid" aria-label="Key metrics">{spec.cards.map((card, index) => {
      const value = preview && !invalidDates ? cardValue(card, rows) : null;
      return <article key={card.title} className={`metric-card tone-${["blue", "green", "amber", "rose"][index % 4]} dashboard-metric`}><div className="metric-top"><span>{card.title}</span><span className={`dashboard-card-state ${value !== null ? "sample" : ""}`}>{value !== null ? "Sample" : "Unavailable"}</span></div><strong>{formatValue(value, card.type)}</strong><small>{card.help}</small></article>;
    })}</section>
    <div className="dashboard-content-grid">
      <article className="panel dashboard-panel"><div className="panel-heading"><div><span className="panel-kicker">{preview ? "Sample comparison" : "Activity overview"}</span><h2>{spec.chartTitle}</h2></div></div>
        {chartRows.length > 0 ? <div className="dashboard-bars" role="img" aria-label={chartRows.map(([label, value]) => `${label}: ${formatValue(value, spec.chartType)}`).join("; ")}>{chartRows.map(([label, value]) => <div className="dashboard-bar-row" key={label}><div><span>{label}</span><b>{formatValue(value, spec.chartType)}</b></div><div className="dashboard-bar-track"><i style={{ width: `${value / chartMax * 100}%` }} /></div></div>)}</div> : <div className="dashboard-empty"><span aria-hidden="true">▥</span><h3>{preview && !invalidDates ? "No matching activity" : "Activity data unavailable"}</h3><p>{preview ? "Adjust the date range or filters to see sample activity." : "A chart will appear when activity data is connected."}</p></div>}
      </article>
      <article className="panel dashboard-panel"><span className="panel-kicker">Next capabilities</span><h2>Workspace readiness</h2><div className="dashboard-readiness">{spec.upcoming.map((item) => <div key={item.title}><span className="dashboard-card-state">Not connected</span><h3>{item.title}</h3><p>{item.reason}</p></div>)}</div></article>
    </div>
    <section className="panel dashboard-panel dashboard-records"><div className="panel-heading"><div><span className="panel-kicker">{preview ? "Sample records" : "Workspace records"}</span><h2>{spec.tableTitle}</h2></div><div className="dashboard-table-tools"><input aria-label="Search dashboard records" placeholder="Search records…" value={search} onChange={(event) => setSearch(event.target.value)} disabled={!preview} /><select aria-label="Sort dashboard records" value={sort} onChange={(event) => setSort(event.target.value)} disabled={!preview}><option value="date-desc">Latest first</option><option value="name-asc">Name A–Z</option></select></div></div>
      <div className="table-scroll"><table><thead><tr><th>{spec.entityLabel}</th>{spec.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Date</th><th>Status</th><th><span className="dashboard-sr-only">Details</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.entity}</b></td>{spec.columns.map((column) => <td key={column.key}>{formatValue(row.values[column.key], column.type)}</td>)}<td>{row.date}</td><td><span className={`dashboard-row-status ${row.status === "Needs review" || row.status === "Onboarding" ? "attention" : ""}`}>{row.status}</span></td><td><button className="dashboard-row-button" aria-label={`View sample details for ${row.values.name ?? row.entity}`} onClick={() => setSelected(row)}>View</button></td></tr>)}</tbody></table></div>
      {rows.length === 0 && <div className="dashboard-empty"><h3>{preview && !invalidDates ? "No matching records" : "Records are not connected"}</h3><p>{preview ? "Try another date range, search, or filter." : "Show sample data to explore this workspace."}</p>{preview && <button className="dashboard-secondary" onClick={resetFilters}>Reset filters</button>}</div>}
    </section>
    <dialog ref={dialog} className="dashboard-dialog" aria-labelledby="record-title" onClose={() => setSelected(null)}><div className="dashboard-dialog-head"><span className="eyebrow">Sample record</span><button aria-label="Close record details" onClick={() => setSelected(null)}>×</button></div><h2 id="record-title">{selected?.values.name ?? selected?.entity}</h2><p className="dashboard-detail-note">Fictional data for interface preview only.</p>{selected && <dl><div><dt>{spec.entityLabel}</dt><dd>{selected.entity}</dd></div>{spec.columns.map((column) => <div key={column.key}><dt>{column.label}</dt><dd>{formatValue(selected.values[column.key], column.type)}</dd></div>)}<div><dt>Date</dt><dd>{selected.date}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div></dl>}<button className="dashboard-secondary" onClick={() => setSelected(null)}>Close details</button></dialog>
  </div>;
}
