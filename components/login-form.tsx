"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function LoginForm() {
  const { user, loading, login, message } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!loading && user) router.replace(`/${user.role}`); }, [loading, user, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try { await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""), String(form.get("tenantKey") ?? "")); }
    catch (error) { setError(error instanceof Error ? error.message : "Sign-in failed."); }
    finally { setPending(false); }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-mark">A</div><span>AnalyticalRx secure workspace</span>
    <h1>Welcome back</h1><p>Sign in to access your pharmacy workspace.</p>
    {loading || user ? <p role="status">Loading your workspace…</p> : <form className="login-form" onSubmit={submit}>
      <label htmlFor="tenantKey">Tenant key</label>
      <input id="tenantKey" name="tenantKey" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="analyticalrx-dev" required disabled={pending} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="username" placeholder="you@pharmacy.com" required disabled={pending} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required disabled={pending} />
      {(error || message) && <div className="login-error" role="alert">{error || message}</div>}
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>}
  </section></main>;
}
