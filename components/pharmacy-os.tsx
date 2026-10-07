"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleDashboard } from "@/components/role-dashboard";
import { UserManagement } from "@/components/user-management";
import { TaskManagement } from "@/components/task-management";
import { roleLabels, workflows } from "@/lib/data";
import type { Role, Section, WorkflowStatus, WorkflowStepType } from "@/lib/types";

type IconName = "grid" | "flow" | "store" | "bell" | "search" | "play" | "chevron" | "pulse" | "shield" | "clock" | "plus" | "menu" | "tasks";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    flow: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="19" r="2"/><path d="M8 5h3a3 3 0 0 1 3 3v1a3 3 0 0 0 3 3M8 19h3a3 3 0 0 0 3-3v-1a3 3 0 0 1 3-3"/></>,
    store: <><path d="M3 10h18M5 10v10h14V10M4 4h16l1 6H3l1-6Z"/><path d="M9 14h6v6"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    play: <path d="m9 7 8 5-8 5V7Z"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    pulse: <path d="M3 12h4l2-6 4 12 2-6h6"/>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    tasks: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="m7 9 1 1 2-2M13 9h4m-10 6 1 1 2-2M13 15h4"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const stepIcons: Record<WorkflowStepType, string> = { trigger: "⌁", search: "⌕", loop: "↻", create: "+", email: "✉", update: "↥" };

export function PharmacyOS({
  role,
  userName,
  allowedRoles = [role],
  onLogout,
  tenantId,
}: {
  role: Role;
  userName: string;
  allowedRoles?: Role[];
  onLogout?: () => void;
  tenantId?: string;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(workflows[0].id);
  const [query, setQuery] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, WorkflowStatus>>({});
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [compactNav, setCompactNav] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1024px)");
    const update = () => {
      setCompactNav(query.matches);
      if (!query.matches) setMobileNav(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileNav || !compactNav) return;
    const panel = sidebar.current;
    if (!panel) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    Object.assign(body.style, { position: "fixed", top: `-${scrollY}px`, width: "100%", overflow: "hidden" });
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled), select, a[href], [tabindex='0']"));
    const focusFrame = window.requestAnimationFrame(() => focusable()[0]?.focus({ preventScroll: true }));
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setMobileNav(false); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (!panel?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKey);
      Object.assign(body.style, previous);
      window.scrollTo(0, scrollY);
      if (window.matchMedia("(max-width: 1024px)").matches) menuButton.current?.focus({ preventScroll: true });
    };
  }, [mobileNav, compactNav]);

  const filteredWorkflows = useMemo(() => workflows.filter((workflow) => `${workflow.name} ${workflow.category}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? workflows[0];
  const selectedStatus = statusOverrides[selectedWorkflow.id] ?? selectedWorkflow.status;
  const canManageWorkflows = role === "owner" || role === "tenant_admin";
  const canManageUsers = role === "owner" || role === "tenant_admin";
  const userInitials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";

  function toggleWorkflow() {
    setStatusOverrides((current) => ({ ...current, [selectedWorkflow.id]: selectedStatus === "active" ? "draft" : "active" }));
    setNotice(selectedStatus === "active" ? "Workflow paused" : "Workflow activated");
    window.setTimeout(() => setNotice(""), 2400);
  }

  function testWorkflow() {
    setRunning(true);
    window.setTimeout(() => {
      setRunning(false);
      setNotice("Test completed · 4 steps validated · no records changed");
      window.setTimeout(() => setNotice(""), 3200);
    }, 900);
  }

  return (
    <div className="app-shell">
      <aside ref={sidebar} id="workspace-navigation" className={`sidebar ${mobileNav ? "sidebar-open" : ""}`} role={compactNav && mobileNav ? "dialog" : undefined} aria-modal={compactNav && mobileNav ? true : undefined} aria-label="Workspace navigation">
        <button className="nav-close" onClick={() => setMobileNav(false)} aria-label="Close navigation">×</button>
        <div className="brand"><div className="brand-mark">A</div><div><strong>AnalyticalRx</strong><span>Operations cloud</span></div></div>
        <div className="workspace-pill"><span className="workspace-avatar">AR</span><div><small>Workspace</small><b>{role === "internal_platform_admin" ? "Platform administration" : tenantId ? `Tenant ${tenantId}` : "Your tenant"}</b></div><Icon name="chevron" size={14}/></div>
        {allowedRoles.length > 1 && <label className="workspace-role-select">Switch dashboard<select aria-label="Switch role dashboard" value={role} onChange={(event) => { setMobileNav(false); router.push(`/${event.target.value}`); }}>{allowedRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>}
        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <button className={section === "overview" ? "nav-item active" : "nav-item"} onClick={() => { setSection("overview"); setMobileNav(false); }}><Icon name="grid"/><span>Overview</span></button>
          <button className={section === "tasks" ? "nav-item active" : "nav-item"} onClick={() => { setSection("tasks"); setMobileNav(false); }}><Icon name="tasks"/><span>Tasks</span></button>
          {canManageWorkflows && <button className={section === "workflows" ? "nav-item active" : "nav-item"} onClick={() => { setSection("workflows"); setMobileNav(false); }}><Icon name="flow"/><span>Automations</span><em>{workflows.length}</em></button>}
        </nav>
        {canManageUsers && <nav aria-label="Administration"><p className="nav-label role-label">Administration</p><button className={section === "users" ? "nav-item active" : "nav-item"} onClick={() => { setSection("users"); setMobileNav(false); }}><Icon name="shield"/><span>User management</span></button></nav>}
        <div className="sidebar-foot"><div className="system-state"><span></span><div><b>Authenticated workspace</b><small>Dashboard data not connected</small></div></div><div className="user-card"><div className="user-avatar">{userInitials}</div><div><b>{userName}</b><span>{roleLabels[role]} access</span></div><button onClick={onLogout} aria-label="Sign out">Sign out</button></div></div>
      </aside>

      <main className="main-area" inert={mobileNav && compactNav}>
        <header className="topbar"><button ref={menuButton} className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation" aria-expanded={mobileNav} aria-controls="workspace-navigation"><Icon name="menu"/></button><div className="crumb"><span>{role === "internal_platform_admin" ? "Platform" : "Your workspace"}</span><Icon name="chevron" size={13}/><b>{section === "overview" ? roleLabels[role] : section === "users" ? "User management" : section === "tasks" ? "Tasks" : "Automations"}</b></div><div className="top-actions"><div className="secure-badge"><Icon name="shield" size={14}/>Verified session</div></div></header>

        {canManageUsers && <div hidden={section !== "users"}><UserManagement tenantId={tenantId} /></div>}
        {section === "tasks" ? <TaskManagement /> : section === "users" ? null : section === "overview" ? (
          <RoleDashboard key={role} role={role} tenantId={tenantId} />
        ) : (
          <div className="workflow-preview-container"><div className="workflow-preview-banner">Workflow preview · Sample definitions only. Changes and tests do not run automations or modify backend records.</div><div className="automation-layout">
            <section className="workflow-sidebar"><div className="workflow-list-head"><div><span className="eyebrow">Automation studio</span><h1>Workflows</h1></div><button className="new-button" aria-label="Create workflow"><Icon name="plus" size={16}/></button></div><label className="workflow-search"><Icon name="search" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a workflow"/></label><div className="workflow-filters"><button className="selected">All {workflows.length}</button><button>Active</button><button>Draft</button></div><div className="workflow-list">{filteredWorkflows.map((workflow) => { const status = statusOverrides[workflow.id] ?? workflow.status; return <button key={workflow.id} className={selectedWorkflow.id === workflow.id ? "workflow-list-item selected" : "workflow-list-item"} onClick={() => setSelectedWorkflowId(workflow.id)}><span className={`workflow-symbol ${workflow.category.toLowerCase()}`}><Icon name={workflow.category === "Compliance" ? "shield" : workflow.category === "Finance" ? "pulse" : "flow"} size={16}/></span><div><b>{workflow.name}</b><small>{workflow.summary}</small><em><i className={`status-dot ${status}`}></i>{status === "attention" ? "Needs attention" : status}</em></div><Icon name="chevron" size={15}/></button>; })}</div></section>

            <section className="workflow-canvas"><div className="canvas-top"><div><span className="category-tag">{selectedWorkflow.category}</span><h2>{selectedWorkflow.name}</h2><p>{selectedWorkflow.summary}</p></div><div className="canvas-actions"><div className={`toggle-wrap ${selectedStatus === "active" ? "on" : ""}`}><button role="switch" aria-checked={selectedStatus === "active"} onClick={toggleWorkflow}><i></i></button><span>{selectedStatus === "active" ? "Active" : "Paused"}</span></div><button className="test-button" onClick={testWorkflow} disabled={running}><Icon name="play" size={15}/>{running ? "Testing…" : "Test workflow"}</button><button className="save-button" disabled title="Backend publishing is not connected">Publish changes</button></div></div><div className="canvas-meta"><span><Icon name="clock" size={14}/>Last run: {selectedWorkflow.lastRun}</span><span><Icon name="pulse" size={14}/>{selectedWorkflow.runCount.toLocaleString("en-US")} total runs</span><span><i className={`status-dot ${selectedStatus}`}></i>{selectedStatus === "attention" ? "Needs attention" : selectedStatus}</span></div><div className="flow-stage"><div className="stage-grid"></div><div className="flow-track"><div className="flow-label">TRIGGER</div>{selectedWorkflow.steps.map((step, index) => <div className="flow-step-wrap" key={step.id}>{index > 0 && <div className="connector"><button aria-label={`Insert step before ${step.title}`}>+</button></div>}<article className={`flow-step ${step.type}`}><div className="step-icon">{stepIcons[step.type]}</div><div><span>{index === 0 ? "Trigger" : step.type === "email" ? "Notification" : step.type === "loop" ? "Advanced logic" : "Action"}</span><h3>{step.title}</h3><p>{step.detail}</p></div><button className="step-menu" aria-label="Step options">•••</button></article>{index === 0 && <div className="flow-label action-label">ACTIONS</div>}</div>)}<button className="add-step"><Icon name="plus" size={16}/>Add action or logic</button></div></div></section>
          </div>
          </div>
        )}
      </main>
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
      {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} aria-hidden="true"></div>}
    </div>
  );
}
