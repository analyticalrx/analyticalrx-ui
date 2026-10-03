export function AuthRequired({ loginUrl }: { loginUrl?: string }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-mark">A</div>
        <span>AnalyticalRx secure workspace</span>
        <h1>Authentication required</h1>
        <p>
          Sign in through your organization&apos;s identity service. Your access and
          workspace view are determined by the verified role in your session token.
        </p>
        {loginUrl ? <a href={loginUrl}>Continue to sign in</a> : <div className="auth-config">Set <code>AUTH_LOGIN_URL</code> to connect the backend login flow.</div>}
      </section>
    </main>
  );
}
