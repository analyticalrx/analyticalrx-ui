"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { importUsers, roleNames, userRoles, validateUser, type UserDraft } from "@/lib/user-management";

export function UserManagement({ tenantId }: { tenantId?: string }) {
  const [users, setUsers] = useState<UserDraft[]>([]);
  const [preview, setPreview] = useState<UserDraft[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const [query, setQuery] = useState("");
  const uploadSequence = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(""); setNotice("");
    try {
      const user = validateUser(Object.fromEntries(["userName", "email", "userId", "password", "role"].map((key) => [key, String(data.get(key) ?? "")])), users);
      setUsers([...users, user]);
      form.reset();
      setNotice(`${user.userName} added to the draft list.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to add user."); }
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const sequence = ++uploadSequence.current;
    setPreview([]); setError(""); setNotice(""); setFileName(file?.name ?? "");
    if (!file) return;
    setReading(true);
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
      if (file.size > 1_000_000) throw new Error("Choose a CSV smaller than 1 MB.");
      const contents = await file.text();
      if (sequence === uploadSequence.current) setPreview(importUsers(contents, users));
    } catch (error) { if (sequence === uploadSequence.current) setError(error instanceof Error ? error.message : "Unable to read CSV."); }
    finally { if (sequence === uploadSequence.current) setReading(false); }
  }

  function confirmImport() {
    setError(""); setNotice("");
    try {
      const validated: UserDraft[] = [];
      for (const user of preview) validated.push(validateUser({ ...user }, [...users, ...validated]));
      setUsers([...users, ...validated]);
      setNotice(`${validated.length} users added to the draft list.`);
      setPreview([]); setFileName("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to import users."); }
  }

  const filtered = users.filter((user) => `${user.userName} ${user.email} ${user.userId} ${roleNames[user.role]}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page-content user-management">
    <section className="page-heading"><div><span className="eyebrow">User administration</span><h1>User management</h1><p>Add people to your tenant, individually or from a CSV.</p></div>{tenantId && <span className="assigned-store">Tenant: {tenantId}</span>}</section>
    <div className="users-info">Frontend preview · Users stay in this workspace until you reload or sign out. Accounts are not created in the backend and cannot sign in yet.</div>
    {error && <div className="login-error" role="alert">{error}</div>}
    {notice && <div className="users-success" role="status">{notice}</div>}
    <div className="users-grid">
      <section className="panel users-card"><span className="panel-kicker">Single user</span><h2>Add a user</h2>
        <form className="login-form" onSubmit={addUser}>
          <label htmlFor="userName">User name</label><input id="userName" name="userName" required maxLength={120} placeholder="Full name" />
          <label htmlFor="userEmail">User email</label><input id="userEmail" name="email" type="email" required placeholder="name@example.com" />
          <label htmlFor="userId">User ID</label><input id="userId" name="userId" required maxLength={120} placeholder="e.g. tech-001" />
          <label htmlFor="userRole">Role</label><select id="userRole" name="role">{userRoles.map((role) => <option key={role} value={role}>{roleNames[role]}</option>)}</select>
          <label htmlFor="userPassword">Password <span className="users-muted">(optional)</span></label><input id="userPassword" name="password" type="password" autoComplete="new-password" placeholder="Leave empty to assign later" aria-describedby="passwordHelp" />
          <small id="passwordHelp" className="users-muted">Leave blank for now; password reset will be available in a future update.</small>
          <button type="submit">Add to draft list</button>
        </form>
      </section>
      <section className="panel users-card"><span className="panel-kicker">Multiple users</span><h2>Import users from CSV</h2><p>Download the sample, replace the example rows, then upload your file. Review the users before adding them.</p>
        <a className="users-download" href="/samples/users.csv" download="analyticalrx-users-sample.csv">Download sample CSV ↓</a>
        <div className="users-upload"><label htmlFor="usersCsv">Choose a CSV file</label><input ref={fileInput} id="usersCsv" type="file" accept=".csv,text/csv" onChange={readFile} /><small>Up to 500 users · 1 MB maximum · Password may be blank</small></div>
        <p className="users-columns">Columns: <code>user_name, email, user_id, password, role</code></p>
        <p className="users-columns">Roles: <code>technician</code>, <code>book_keeper</code>, <code>store_manager</code></p>
        {reading && <p role="status">Reading CSV…</p>}
        {preview.length > 0 && <div className="users-preview"><h3>{preview.length} users ready for review</h3><p>{fileName}</p><div className="table-scroll" role="region" aria-label="CSV preview, scroll horizontally for more columns" tabIndex={0}><table><thead><tr><th>Name</th><th>User ID</th><th>Role</th></tr></thead><tbody>{preview.map((user) => <tr key={user.userId}><td>{user.userName}<small>{user.email}</small></td><td>{user.userId}</td><td>{roleNames[user.role]}</td></tr>)}</tbody></table></div><button className="save-button" onClick={confirmImport}>Add {preview.length} users to draft list</button><button className="text-button" onClick={() => { setPreview([]); setFileName(""); if (fileInput.current) fileInput.current.value = ""; }}>Cancel import</button></div>}
      </section>
    </div>
    <section className="panel users-card users-list"><div className="panel-heading"><div><span className="panel-kicker">Current workspace</span><h2>Draft users <span className="count-badge">{users.length}</span></h2></div><input className="users-search" aria-label="Search draft users" placeholder="Search users…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {users.length === 0 ? <div className="users-empty"><h3>No users added yet</h3><p>Add your first user or import a CSV to get started.</p></div> : <div className="table-scroll" role="region" aria-label="Draft users, scroll horizontally for more columns" tabIndex={0}><table><thead><tr><th>Name / email</th><th>User ID</th><th>Role</th><th>Password</th><th>Status</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.userId}><td><b>{user.userName}</b><small>{user.email}</small></td><td>{user.userId}</td><td>{roleNames[user.role]}</td><td>{user.password ? "Provided" : "Not assigned"}</td><td><span className="status-pill">Draft</span></td></tr>)}</tbody></table>{filtered.length === 0 && <p className="users-empty">No users match your search.</p>}</div>}
    </section>
  </div>;
}
