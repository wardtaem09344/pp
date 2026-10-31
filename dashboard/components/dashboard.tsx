"use client";

import { useEffect, useState } from "react";

type Status = { connected?: boolean; running?: boolean; state: string; message?: string; error?: string };

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/control/status", { cache: "no-store" });
      if (response.status === 401) { window.location.replace("/login"); return; }
      setStatus(await response.json());
    } catch {
      setStatus({ connected: false, state: "unreachable", message: "Could not check the runtime." });
    }
  }

  async function control(action: "start" | "stop") {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/control/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The action could not be completed.");
      setStatus({ connected: true, ...data });
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The action could not be completed.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(id);
  }, []);

  const state = status?.state ?? "checking";
  const label = state === "running" ? "Running" : state === "starting" ? "Starting" : state === "stopped" ? "Stopped" : state === "not_configured" ? "Setup pending" : state === "error" ? "Startup error" : state === "unreachable" ? "Offline" : "Checking";
  const connected = status?.connected === true;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">D</span> DeepSeek <b>Harness</b></a>
        <div className="top-actions"><span className="private-pill"><i /> PRIVATE PASSWORD ACCESS</span><button className="ghost" onClick={logout}>Lock workspace</button></div>
      </header>
      <section className="welcome">
        <div><div className="eyebrow">CONTROL CENTER</div><h1>Your workspace.</h1><p className="muted">A private home for your DeepSeek Harness runtime.</p></div>
        <div className="status-chip"><i className={state === "running" ? "live" : ""} />{label}</div>
      </section>
      <section className="grid">
        <article className="panel main-panel">
          <div className="panel-head"><div><div className="eyebrow">RUNTIME</div><h2>Harness instance</h2></div><span className="tag">NODE.JS 24+</span></div>
          <div className="runtime-visual"><div className="orb"><span> D </span></div><div><strong>{label}</strong><p className="muted">{actionError || status?.message || "Checking runtime connection…"}</p></div></div>
          <div className="control-actions">
            <button className="start-button" onClick={() => void control("start")} disabled={!connected || busy || state === "running" || state === "starting"}>{busy && state !== "running" ? "Please wait…" : "▶ تشغيل المشروع"}</button>
            <button className="stop-button" onClick={() => void control("stop")} disabled={!connected || busy || state !== "running"}>إيقاف المشروع</button>
          </div>
          <div className="panel-foot"><span>Automatic status refresh</span><span>Every 10 seconds</span></div>
        </article>
        <article className="panel">
          <div className="eyebrow">ACCESS</div><h2>Private by design</h2>
          <p className="muted">Protected by Vercel team authentication and a separate password. Control requests are verified server-side and never expose the runtime token to the browser.</p>
          <div className="secure-line"><i /> Two layers of access protection enabled</div>
        </article>
        <article className="panel wide">
          <div className="eyebrow">RUNTIME CONNECTION</div><h2>{connected ? "Runtime controller connected" : "Waiting for runtime connection"}</h2>
          <p className="muted">{connected ? "The private controller is online. Use the start button to launch the Harness Web profile; use stop to shut it down." : "The dashboard is ready. The runtime service must finish its first deployment before the controls become available."}</p>
          <div className="progress"><span style={{ width: connected ? "100%" : "35%" }} /></div><div className="panel-foot"><span>Dashboard</span><strong>{connected ? "Connected" : "Runtime setup pending"}</strong></div>
        </article>
      </section>
      <footer>PRIVATE WORKSPACE <span>•</span> DEEPSEEK HARNESS</footer>
    </main>
  );
}
