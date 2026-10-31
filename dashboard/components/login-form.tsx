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
        <div className="mark">D</div>
        <h1>Welcome back.</h1>
        <p className="muted">Enter your private access password to open the DeepSeek Harness workspace.</p>
        <form onSubmit={submit}>
          <label htmlFor="password">Access password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required maxLength={256} autoFocus />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !password}>{busy ? "Checking…" : "Unlock workspace"} <span>↗</span></button>
        </form>
        <p className="tiny">Protected session · Secure, HTTP-only cookie</p>
      </section>
    </main>
  );
}
