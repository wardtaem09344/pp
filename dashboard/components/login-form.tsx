"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign-in failed");
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="eyebrow">PRIVATE ACCESS · AUTHENTICATED</div>
        <div className="mark">W</div>
        <h1>Welcome to WARDBOT.</h1>
        <p className="muted">سجّل الدخول للوصول إلى مساحة العمل الخاصة.</p>
        <a className="google-login-button" href="/api/auth/google">
          <svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.73 6C44.43 37.96 46.98 31.88 46.98 24.55z"/>
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span>المتابعة باستخدام Google</span>
          <span aria-hidden="true">↗</span>
        </a>
        <div className="login-divider"><span>أو استخدم كلمة المرور</span></div>
        <form onSubmit={submit}>
          <label htmlFor="password">Access password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required maxLength={256} />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !password}>{busy ? "Checking…" : "Unlock workspace"} <span>↗</span></button>
        </form>
        <p className="tiny">Protected session · Secure, HTTP-only cookie</p>
      </section>
    </main>
  );
}
