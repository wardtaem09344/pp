"use client";

import { useEffect, useState } from "react";

type Status = { connected: boolean; state: string; message?: string; url?: string };

export default function Dashboard({ authenticated: initial }: { authenticated: boolean }) {
  const [authenticated, setAuthenticated] = useState(initial);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/control/status", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); return; }
    setStatus(await response.json());
  }

  useEffect(() => {
    if (!authenticated) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(id);
  }, [authenticated]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      setPassword(""); setAuthenticated(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed"); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setAuthenticated(false); setStatus(null);
  }

  if (!authenticated) return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={login}>
        <div className="eyebrow">PRIVATE INSTANCE</div>
        <div className="mark">D</div>
        <h1>DeepSeek Harness</h1>
        <p className="muted">Sign in to your private control panel.</p>
        <label htmlFor="password">Dashboard password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"} <span>↗</span></button>
        <p className="tiny">Access is restricted to your private session.</p>
      </form>
    </main>
  );

  const state = status?.state ?? "checking";
  const label = state === "running" ? "Running" : state === "not_configured" ? "Setup pending" : state === "unreachable" ? "Offline" : "Checking";
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">D</span> DeepSeek <b>Harness</b></a>
        <div className="top-actions"><span className="private-pill"><i /> PRIVATE INSTANCE</span><button className="ghost" onClick={logout}>Sign out</button></div>
      </header>
      <section className="welcome">
        <div><div className="eyebrow">CONTROL CENTER</div><h1>Your workspace.</h1><p className="muted">A private home for your DeepSeek Harness runtime.</p></div>
        <div className="status-chip"><i className={state === "running" ? "live" : ""} />{label}</div>
      </section>
      <section className="grid">
        <article className="panel main-panel">
          <div className="panel-head"><div><div className="eyebrow">RUNTIME</div><h2>Harness instance</h2></div><span className="tag">NODE.JS 24+</span></div>
          <div className="runtime-visual"><div className="orb"><span> D </span></div><div><strong>{label}</strong><p className="muted">{status?.message || "Checking runtime connection…"}</p></div></div>
          <div className="panel-foot"><span>Automatic status refresh</span><span>Every 15 seconds</span></div>
        </article>
        <article className="panel">
          <div className="eyebrow">ACCESS</div><h2>Private by design</h2>
          <p className="muted">The dashboard requires a password and uses a secure, HTTP-only session cookie.</p>
          <div className="secure-line"><i /> Authentication enabled</div>
        </article>
        <article className="panel wide">
          <div className="eyebrow">NEXT STEP</div><h2>Connect your runtime</h2>
          <p className="muted">The dashboard shell is ready. The persistent Node.js service still needs to be provisioned and connected before the Harness can be opened here.</p>
          <div className="progress"><span /></div><div className="panel-foot"><span>Dashboard foundation</span><strong>Ready for runtime setup</strong></div>
        </article>
      </section>
      <footer>PRIVATE WORKSPACE <span>•</span> DEEPSEEK HARNESS</footer>
    </main>
  );
}
