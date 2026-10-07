"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  canUpdateTask, dueDateToIso, formatTaskDate, isClosedTask, isOverdueTask,
  parseComments, parsePharmacies, parseTask, parseTaskContext, taskPriorities,
  taskPriorityLabels, taskStatuses, taskStatusLabels, validateCreateTask, validateTaskComment,
  type Task, type TaskComment, type TaskContext, type TaskPharmacy, type TaskStatus,
} from "@/lib/tasks";

type ApiFetch = ReturnType<typeof useAuth>["apiFetch"];
class TaskApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function requestJson(apiFetch: ApiFetch, path: string, options?: RequestInit): Promise<unknown> {
  const response = await apiFetch(path, options);
  let data;
  try { data = await response.json(); } catch { throw new Error("The task service returned an unreadable response. Refresh and try again."); }
  if (!response.ok) throw new TaskApiError(typeof data?.error === "string" ? data.error : "The request could not be completed. Try again.", response.status);
  return data;
}
function message(error: unknown): string { return error instanceof Error ? error.message : "Unable to reach the task service. Try again."; }
function TaskBadge({ status }: { status: TaskStatus }) { return <span className={`task-badge task-status-${status.toLowerCase()}`}>{taskStatusLabels[status]}</span>; }
function TaskError({ error, retry }: { error: string; retry?: () => void }) {
  return <div className="task-error" role="alert"><p>{error}</p>{retry && <button className="task-button secondary" onClick={retry}>Try again</button>}</div>;
}
function UserReference({ id, context }: { id: number; context: TaskContext }) {
  return <>{id === context.user.id ? `${context.user.displayName} (you)` : `User #${id}`}</>;
}

export function TaskManagement() {
  const { apiFetch } = useAuth();
  const [context, setContext] = useState<TaskContext | null>(null);
  const [pharmacies, setPharmacies] = useState<TaskPharmacy[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState("");
  const [pharmacyError, setPharmacyError] = useState("");
  const [contextRevision, setContextRevision] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [pharmacyKey, setPharmacyKey] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [assignment, setAssignment] = useState("all");
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canRead = context?.permissions.includes("task.read") ?? false;
  const canCreate = context?.permissions.includes("task.create") ?? false;
  const refreshList = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setContextLoading(true); setContextError(""); setPharmacyError(""); setContext(null); setPharmacies([]);
    async function loadContext() {
      try {
        const current = parseTaskContext(await requestJson(apiFetch, "/api/me", { signal: controller.signal }));
        if (controller.signal.aborted) return;
        setContext(current);
        if (current.permissions.includes("task.read") || current.permissions.includes("task.create")) {
          try {
            const pharmacies = parsePharmacies(await requestJson(apiFetch, "/api/pharmacies", { signal: controller.signal }));
            if (!controller.signal.aborted) setPharmacies(pharmacies);
          } catch (error) { if (!controller.signal.aborted) setPharmacyError(message(error)); }
        }
      } catch (error) { if (!controller.signal.aborted) setContextError(message(error)); }
      finally { if (!controller.signal.aborted) setContextLoading(false); }
    }
    void loadContext();
    return () => controller.abort();
  }, [apiFetch, contextRevision]);

  useEffect(() => {
    const controller = new AbortController();
    setTasks([]); setError("");
    if (!canRead || contextLoading) { setLoading(false); return; }
    setLoading(true);
    async function loadTasks() {
      const query = new URLSearchParams();
      if (pharmacyKey) query.set("pharmacyKey", pharmacyKey);
      if (status) query.set("status", status);
      try {
        const data = await requestJson(apiFetch, `/api/tasks${query.size ? `?${query}` : ""}`, { signal: controller.signal });
        if (!Array.isArray(data)) throw new Error("The task service returned an invalid list. Try again.");
        const tasks = data.map(parseTask);
        if (!controller.signal.aborted) setTasks(tasks);
      } catch (error) { if (!controller.signal.aborted) setError(message(error)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void loadTasks();
    return () => controller.abort();
  }, [apiFetch, canRead, contextLoading, pharmacyKey, status, revision]);

  useEffect(() => {
    document.querySelector<HTMLElement>(".tasks-heading")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const pharmacy = pharmacies.find((item) => item.pharmacyKey === task.pharmacyKey);
    const matchesSearch = `${task.id} ${task.title} ${task.description ?? ""} ${task.pharmacyKey} ${pharmacy?.displayName ?? ""} ${task.assigneeUserId}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (assignment === "all" || assignment === "mine" && task.assigneeUserId === context?.user.id || assignment === "created" && task.createdByUserId === context?.user.id);
  }), [tasks, pharmacies, search, assignment, context]);
  const pharmacyName = (key: string) => pharmacies.find((item) => item.pharmacyKey === key)?.displayName ?? key;
  function backToList() { setView("list"); setSelectedId(null); }

  return <div className="page-content task-management">
    <section className="page-heading tasks-page-heading"><div><span className="eyebrow">Team workspace</span><h1 className="tasks-heading" tabIndex={-1}>{view === "create" ? "New task" : view === "detail" ? "Task details" : "Tasks"}</h1><p>{view === "create" ? "Assign work to a pharmacy team member." : view === "detail" ? "Review the work, update progress, and keep the conversation together." : "Coordinate pharmacy work, follow progress, and keep your team informed."}</p></div><div className="task-heading-actions">
      {view !== "list" ? <button className="task-button secondary" disabled={busy} onClick={backToList}>← Back to tasks</button> : <><button className="task-button secondary" disabled={contextLoading || loading} onClick={() => { setContextRevision((value) => value + 1); refreshList(); }}>Refresh</button>{canCreate && <button className="task-button" disabled={contextLoading || !!pharmacyError || pharmacies.length === 0} onClick={() => { setView("create"); setNotice(""); }}>+ New task</button>}</>}
    </div></section>
    {notice && <div className="task-success" role="status">{notice}</div>}
    {contextLoading ? <div className="task-state panel" role="status">Checking your task access…</div> : contextError ? <TaskError error={contextError} retry={() => setContextRevision((value) => value + 1)} /> : context && !canRead && !canCreate ? <section className="panel task-state"><span className="task-state-symbol" aria-hidden="true">◇</span><h2>Task access is not enabled</h2><p>Tasks are available in every workspace. Your account currently has no task permissions. Contact your administrator to request access.</p><button className="task-button secondary" onClick={() => setContextRevision((value) => value + 1)}>Check access again</button></section> : context && <>
      {pharmacyError && <TaskError error={`Pharmacies could not be loaded. ${pharmacyError}`} retry={() => setContextRevision((value) => value + 1)} />}
      {!pharmacyError && pharmacies.length === 0 && <div className="task-info">No active pharmacies are assigned to your account. Task creation requires an accessible pharmacy.</div>}
      {view === "create" && canCreate ? <CreateTaskForm context={context} pharmacies={pharmacies} apiFetch={apiFetch} onBusyChange={setBusy} onCancel={backToList} onCreated={(task) => { setNotice(`Task #${task.id} created.`); refreshList(); setSelectedId(task.id); setView("detail"); }} /> : view === "detail" && selectedId !== null ? <TaskDetails key={selectedId} id={selectedId} context={context} pharmacies={pharmacies} apiFetch={apiFetch} onBusyChange={setBusy} onChanged={refreshList} /> : <>
        <section className="task-summary" aria-label="Tasks in the loaded result">{[
          ["Open tasks", tasks.filter((task) => !isClosedTask(task.status)).length],
          ["Overdue", tasks.filter(isOverdueTask).length],
          ["Blocked", tasks.filter((task) => task.status === "BLOCKED").length],
          ["Completed", tasks.filter((task) => task.status === "COMPLETED").length],
        ].map(([label, count]) => <article className="panel" key={label}><span>{label}</span><strong>{loading || error || !canRead ? "—" : count}</strong><small>In the loaded result</small></article>)}</section>
        <section className="panel task-filters" aria-label="Task filters"><label>Pharmacy<select value={pharmacyKey} disabled={!!pharmacyError} onChange={(event) => setPharmacyKey(event.target.value)}><option value="">All accessible pharmacies</option>{pharmacies.map((pharmacy) => <option key={pharmacy.pharmacyKey} value={pharmacy.pharmacyKey}>{pharmacy.displayName}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{taskStatuses.map((value) => <option key={value} value={value}>{taskStatusLabels[value]}</option>)}</select></label><label>Assignment<select value={assignment} onChange={(event) => setAssignment(event.target.value)}><option value="all">All visible tasks</option><option value="mine">Assigned to me</option><option value="created">Created by me</option></select></label><label className="task-search">Search loaded tasks<input type="search" placeholder="Title, pharmacy, or user ID…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="task-button secondary" onClick={() => { setPharmacyKey(""); setStatus(""); setSearch(""); setAssignment("all"); }}>Reset</button></section>
        <div className="task-result-note"><span>{loading ? "Loading tasks…" : `${visibleTasks.length} tasks shown`}</span><span>Up to 100 tasks per result · Dates use your device time zone</span></div>
        {loading ? <div className="panel task-state" role="status">Loading your tasks…</div> : error ? <TaskError error={error} retry={refreshList} /> : !canRead ? <div className="task-info">Your account can create tasks, but viewing task lists requires task access.</div> : visibleTasks.length === 0 ? <section className="panel task-state"><span className="task-state-symbol" aria-hidden="true">✓</span><h2>{tasks.length ? "No matching tasks" : "No tasks to show"}</h2><p>{tasks.length ? "Try a different search or assignment filter." : "There are no visible tasks for these pharmacy and status filters."}</p>{canCreate && <button className="task-button" disabled={!!pharmacyError || pharmacies.length === 0} onClick={() => setView("create")}>Create a task</button>}</section> : <ul className="task-list">{visibleTasks.map((task) => <li key={task.id}><button className="panel task-list-item" onClick={() => { setSelectedId(task.id); setView("detail"); setNotice(""); }} aria-label={`Open task #${task.id}: ${task.title}`}><span className="task-list-main"><span className="task-list-id">#{task.id} · {pharmacyName(task.pharmacyKey)}</span><strong>{task.title}</strong><span className="task-list-person">Assigned to <UserReference id={task.assigneeUserId} context={context} /></span></span><span className="task-list-meta"><span className={`task-priority task-priority-${task.priority.toLowerCase()}`}>{taskPriorityLabels[task.priority]} priority</span><span className={isOverdueTask(task) ? "task-overdue" : ""}>{isOverdueTask(task) ? "Overdue · " : ""}{formatTaskDate(task.dueAt)}</span></span><span className="task-list-status"><TaskBadge status={task.status} /><span aria-hidden="true">↗</span></span></button></li>)}</ul>}
        {tasks.length === 100 && <div className="task-info">This result reached the 100-task limit. Filter by pharmacy or status to find more specific work.</div>}
      </>}
    </>}
  </div>;
}

function CreateTaskForm({ context, pharmacies, apiFetch, onCreated, onCancel, onBusyChange }: {
  context: TaskContext; pharmacies: TaskPharmacy[]; apiFetch: ApiFetch; onCreated: (task: Task) => void; onCancel: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [pharmacyKey, setPharmacyKey] = useState(pharmacies.length === 1 ? pharmacies[0].pharmacyKey : "");
  useEffect(() => { onBusyChange(saving); return () => onBusyChange(false); }, [saving, onBusyChange]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    setError(""); setSaving(true);
    try {
      if (!/^[1-9]\d*$/.test(assignee)) throw new Error("Enter a positive numeric assignee user ID.");
      const input = validateCreateTask({
        title: data.get("title"), description: data.get("description"), pharmacyKey,
        assigneeUserId: Number(assignee), priority: data.get("priority"), dueAt: dueDateToIso(String(data.get("dueAt") ?? "")),
      });
      const task = parseTask(await requestJson(apiFetch, "/api/tasks", { method: "POST", body: JSON.stringify(input) }));
      onCreated(task);
    } catch (error) { setError(message(error)); }
    finally { setSaving(false); }
  }
  return <section className="panel task-editor"><span className="panel-kicker">Task assignment</span><h2>Make the next step clear</h2><p className="task-muted">Give your team a specific action and a clear owner.</p>
    <form className="task-form" onSubmit={submit}>
      <fieldset disabled={saving}><label>Task title<input name="title" required maxLength={200} placeholder="e.g. Review the refill queue" autoFocus /></label><label>Description <span>(optional)</span><textarea name="description" maxLength={4000} rows={5} placeholder="Add context, instructions, or what done looks like." /></label>
      <div className="task-form-grid"><label>Pharmacy<select name="pharmacyKey" required value={pharmacyKey} onChange={(event) => setPharmacyKey(event.target.value)}><option value="">Choose a pharmacy</option>{pharmacies.map((pharmacy) => <option key={pharmacy.pharmacyKey} value={pharmacy.pharmacyKey}>{pharmacy.displayName}</option>)}</select></label><label>Priority<select name="priority" defaultValue="MEDIUM">{taskPriorities.map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority]}</option>)}</select></label></div>
      <div className="task-form-grid"><label>Assignee user ID<input name="assigneeUserId" inputMode="numeric" pattern="[0-9]+" required value={assignee} onChange={(event) => setAssignee(event.target.value)} aria-describedby="task-assignee-help" placeholder="e.g. 5" /></label><label>Due date and time <span>(optional)</span><input name="dueAt" type="datetime-local" /><small>Your device time zone; saved as an absolute time.</small></label></div>
      <div className="task-assignee-help" id="task-assignee-help"><p>Enter the existing user ID of an active team member with task access to this pharmacy. A searchable team directory is not available yet.</p>{context.permissions.includes("task.read") && <button type="button" className="task-button secondary" onClick={() => setAssignee(String(context.user.id))}>Assign to me</button>}</div>
      </fieldset>
      {error && <TaskError error={error} />}
      <div className="task-form-actions"><button className="task-button" type="submit" disabled={saving}>{saving ? "Creating task…" : "Create task"}</button><button className="task-button secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button></div>
    </form>
  </section>;
}

function TaskDetails({ id, context, pharmacies, apiFetch, onChanged, onBusyChange }: {
  id: number; context: TaskContext; pharmacies: TaskPharmacy[]; apiFetch: ApiFetch; onChanged: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("TODO");
  const [comment, setComment] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [commentsRevision, setCommentsRevision] = useState(0);
  useEffect(() => { onBusyChange(savingStatus || savingComment); return () => onBusyChange(false); }, [savingStatus, savingComment, onBusyChange]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setTask(null);
    async function load() {
      try {
        const task = parseTask(await requestJson(apiFetch, `/api/tasks/${id}`, { signal: controller.signal }));
        if (!controller.signal.aborted) { setTask(task); setNewStatus(task.status); }
      } catch (error) { if (!controller.signal.aborted) setError(message(error)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [id, apiFetch, revision]);

  useEffect(() => {
    const controller = new AbortController();
    setCommentsLoading(true); setCommentsError(""); setComments([]);
    async function load() {
      try {
        const comments = parseComments(await requestJson(apiFetch, `/api/tasks/${id}/comments`, { signal: controller.signal }));
        if (!controller.signal.aborted) setComments(comments);
      } catch (error) { if (!controller.signal.aborted) setCommentsError(message(error)); }
      finally { if (!controller.signal.aborted) setCommentsLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [id, apiFetch, commentsRevision, revision]);

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingStatus) return;
    setSavingStatus(true); setStatusError(""); setNotice("");
    try {
      const updated = parseTask(await requestJson(apiFetch, `/api/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) }));
      setTask(updated); setNewStatus(updated.status); onChanged(); setNotice(`Status changed to ${taskStatusLabels[updated.status].toLowerCase()}.`);
    } catch (error) {
      setStatusError(message(error));
      if (error instanceof TaskApiError && error.status === 409) { setRevision((value) => value + 1); onChanged(); }
    } finally { setSavingStatus(false); }
  }
  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingComment) return;
    setSavingComment(true); setCommentError(""); setNotice("");
    try {
      const input = validateTaskComment({ commentText: comment });
      const [created] = parseComments([await requestJson(apiFetch, `/api/tasks/${id}/comments`, { method: "POST", body: JSON.stringify(input) })]);
      setComments((current) => [...current, created]); setComment(""); setNotice("Comment added.");
      // Refresh the conversation so it also includes other team members' changes.
      setCommentsRevision((value) => value + 1);
    } catch (error) { setCommentError(message(error)); }
    finally { setSavingComment(false); }
  }

  if (loading) return <div className="panel task-state" role="status">Loading task details…</div>;
  if (error) return <TaskError error={error} retry={() => setRevision((value) => value + 1)} />;
  if (!task) return null;
  const pharmacy = pharmacies.find((pharmacy) => pharmacy.pharmacyKey === task.pharmacyKey);
  const canUpdate = canUpdateTask(context, task);
  return <div className="task-detail-layout">
    <section className="panel task-detail-card"><div className="task-detail-top"><span className="panel-kicker">Task #{task.id}</span><TaskBadge status={task.status} /></div><h2>{task.title}</h2><p className="task-description">{task.description || "No description provided."}</p>
      <dl className="task-facts"><div><dt>Pharmacy</dt><dd>{pharmacy?.displayName ?? task.pharmacyKey}<small>{task.pharmacyKey}</small></dd></div><div><dt>Priority</dt><dd><span className={`task-priority task-priority-${task.priority.toLowerCase()}`}>{taskPriorityLabels[task.priority]}</span></dd></div><div><dt>Assigned to</dt><dd><UserReference id={task.assigneeUserId} context={context} /><small>User #{task.assigneeUserId}</small></dd></div><div><dt>Created by</dt><dd><UserReference id={task.createdByUserId} context={context} /></dd></div><div><dt>Due</dt><dd className={isOverdueTask(task) ? "task-overdue" : ""}>{formatTaskDate(task.dueAt)}</dd></div><div><dt>Created</dt><dd>{formatTaskDate(task.createdAt)}</dd></div><div><dt>Updated</dt><dd>{formatTaskDate(task.updatedAt)}</dd></div>{task.completedAt && <div><dt>Completed</dt><dd>{formatTaskDate(task.completedAt)}</dd></div>}</dl>
      <p className="task-muted">Dates and times use your device time zone.</p>
      <div className="task-status-editor"><h3>Update progress</h3>{canUpdate ? <form className="task-form" onSubmit={updateStatus}><label>Task status<select value={newStatus} onChange={(event) => setNewStatus(event.target.value as TaskStatus)} disabled={savingStatus}>{taskStatuses.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}</select></label><p className="task-muted">Completed, skipped, and canceled tasks cannot be reopened.</p><button className="task-button" type="submit" disabled={savingStatus || newStatus === task.status}>{savingStatus ? "Saving status…" : "Save status"}</button></form> : <p className="task-muted">{isClosedTask(task.status) ? "This task is closed. Its status can no longer be changed." : "Only the assignee or a pharmacy manager with task update permission can change this status."}</p>}</div>
      {statusError && <TaskError error={statusError} />}
      <button className="task-button secondary task-refresh" disabled={savingStatus || savingComment} onClick={() => { setRevision((value) => value + 1); setStatusError(""); setNotice(""); }}>Refresh details</button>
    </section>
    <section className="panel task-comments-card"><span className="panel-kicker">Team conversation</span><h2>Comments</h2>{notice && <div className="task-success" role="status">{notice}</div>}
      {commentsLoading ? <p className="task-muted" role="status">Loading comments…</p> : commentsError ? <TaskError error={commentsError} retry={() => setCommentsRevision((value) => value + 1)} /> : comments.length === 0 ? <div className="task-comments-empty"><h3>No comments yet</h3><p>Share an update or add useful context for your team.</p></div> : <ol className="task-comments">{comments.map((comment) => <li key={comment.id}><div><strong><UserReference id={comment.authorUserId} context={context} /></strong><time dateTime={comment.createdAt}>{formatTaskDate(comment.createdAt)}</time></div><p>{comment.commentText}</p></li>)}</ol>}
      {context.permissions.includes("task.comment") ? <form className="task-form task-comment-form" onSubmit={addComment}><label>Add a comment<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={2000} required disabled={savingComment} placeholder="Share a progress update…" /></label><small className="task-muted">{comment.length}/2000 characters</small>{commentError && <TaskError error={commentError} />}<button className="task-button" type="submit" disabled={savingComment || !comment.trim()}>{savingComment ? "Adding comment…" : "Add comment"}</button></form> : <p className="task-muted">Your account has read-only access to this conversation.</p>}
    </section>
  </div>;
}
