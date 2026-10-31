"use client";

import { useEffect, useState } from "react";

type Status = { connected: boolean; state: string; message?: string; url?: string };

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/control/status", { cache: "no-store" });
      setStatus(await response.json());
    } catch {
      setStatus({ connected: false, state: "unreachable", message: "Could not check the runtime." });
    }
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(id);
  }, []);

  const state = status?.state ?? "checking";
  const label = state === "running" ? "Running" : state === "not_configured" ? "Setup pending" : state === "unreachable" ? "Offline" : "Checking";

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">D</span> DeepSeek <b>Harness</b></a>
        <div className="top-actions"><span className="private-pill"><i /> VERCEL TEAM-ONLY ACCESS</span></div>
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
          <p className="muted">Vercel team authentication protects the dashboard and its API routes. Preview deployments are disabled.</p>
          <div className="secure-line"><i /> Team-only access enabled</div>
        </article>
        <article className="panel wide">
          <div className="eyebrow">NEXT STEP</div><h2>Connect your runtime</h2>
          <p className="muted">The dashboard foundation is deployed separately. The persistent Node.js service still needs to be provisioned and connected before the Harness can be opened here.</p>
          <div className="progress"><span /></div><div className="panel-foot"><span>Dashboard foundation</span><strong>Ready for runtime setup</strong></div>
        </article>
      </section>
      <footer>PRIVATE WORKSPACE <span>•</span> DEEPSEEK HARNESS</footer>
    </main>
  );
}
