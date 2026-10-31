"use client";

import { useEffect, useRef, useState } from "react";

type Status = { connected?: boolean; running?: boolean; state: string; message?: string; error?: string; launchUrl?: string | null };
type LogLine = { id: number; time: string; stream: string; text: string };

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const latestLogId = useRef(0);
  const terminalEnd = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/control/status", { cache: "no-store" });
      if (response.status === 401) { window.location.replace("/login"); return; }
      setStatus(await response.json());
    } catch {
      setStatus({ connected: false, state: "unreachable", message: "تعذّر الاتصال بخادم التشغيل." });
    }
  }

  async function refreshLogs() {
    try {
      const response = await fetch("/api/control/logs?after=" + latestLogId.current, { cache: "no-store" });
      if (response.status === 401) { window.location.replace("/login"); return; }
      const data = await response.json();
      if (Array.isArray(data.logs) && data.logs.length) {
        setLogs(previous => {
          const known = new Set(previous.map(item => item.id));
          return [...previous, ...data.logs.filter((item: LogLine) => !known.has(item.id))].slice(-250);
        });
      }
      if (typeof data.latestId === "number") latestLogId.current = Math.max(latestLogId.current, data.latestId);
    } catch {
      // Keep the last visible output; the next poll will retry.
    }
  }

  async function control(action: "start" | "stop" | "restart") {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/control/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذّر تنفيذ الأمر.");
      setStatus({ connected: true, ...data });
      await Promise.all([refresh(), refreshLogs()]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذّر تنفيذ الأمر.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!status?.launchUrl) return;
    try {
      await navigator.clipboard.writeText(status.launchUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("تعذّر نسخ الرابط من المتصفح.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  useEffect(() => {
    void refresh();
    void refreshLogs();
    const id = window.setInterval(() => {
      void refresh();
      void refreshLogs();
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (autoScroll) terminalEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs, autoScroll]);

  const state = status?.state ?? "checking";
  const label = state === "running" ? "يعمل" : state === "starting" ? "قيد التشغيل" : state === "stopped" ? "متوقف" : state === "not_configured" ? "الإعداد ناقص" : state === "error" ? "خطأ بالتشغيل" : state === "unreachable" ? "غير متصل" : "جارٍ الفحص";
  const connected = status?.connected === true;
  const isRunning = state === "running";
  const launchUrl = status?.launchUrl;

  return (
    <main className="shell" dir="rtl">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">D</span> DeepSeek <b>Harness</b></a>
        <div className="top-actions"><span className="private-pill"><i /> مساحة خاصة ومحمية</span><button className="ghost" onClick={logout}>قفل اللوحة</button></div>
      </header>

      <section className="welcome">
        <div><div className="eyebrow">مركز التحكم</div><h1>لوحة إدارة Harness</h1><p className="muted">تشغيل الخدمة ومراقبة ما يحدث مباشرةً من مكان واحد.</p></div>
        <div className={"status-chip " + (isRunning ? "status-running" : "")}><i className={isRunning ? "live" : ""} />{label}</div>
      </section>

      <section className="grid">
        <article className="panel main-panel">
          <div className="panel-head"><div><div className="eyebrow">حالة الخدمة</div><h2>DeepSeek Harness Runtime</h2></div><span className="tag">NODE.JS 24+</span></div>
          <div className="runtime-visual"><div className="orb"><span>D</span></div><div><strong>{label}</strong><p className="muted">{actionError || status?.message || "جارٍ الاتصال بخادم التشغيل…"}</p></div></div>
          <div className="control-actions">
            <button className="start-button" onClick={() => void control("start")} disabled={!connected || busy || isRunning || state === "starting"}>{busy ? "لحظة…" : "▶ تشغيل Harness"}</button>
            <button className="stop-button" onClick={() => void control("stop")} disabled={!connected || busy || (!isRunning && state !== "starting")}>■ إيقاف Harness</button>
            <button className="ghost refresh-button" onClick={() => void control("restart")} disabled={!connected || busy || !isRunning}>↻ إعادة التشغيل</button>
            <button className="ghost refresh-button" onClick={() => { void refresh(); void refreshLogs(); }} disabled={busy}>تحديث الحالة</button>
          </div>
          <div className="panel-foot"><span>تحديث تلقائي</span><span>كل 2.5 ثانية</span></div>
        </article>

        <article className="panel link-panel">
          <div className="eyebrow">رابط الواجهة</div><h2>فتح Harness Web</h2>
          <p className="muted">يظهر الرابط هنا بعد ما تصبح الواجهة جاهزة.</p>
          {launchUrl ? (
            <div className="link-actions">
              <a className="runtime-link" href={launchUrl} target="_blank" rel="noreferrer">فتح واجهة Harness ↗</a>
              <button className="ghost" onClick={() => void copyLink()}>{copied ? "تم النسخ ✓" : "نسخ الرابط"}</button>
            </div>
          ) : <div className="link-placeholder">{state === "starting" ? "بانتظار اكتمال التشغيل…" : "الرابط غير متاح حاليًا"}</div>}
          <div className="secure-line"><i /> الرابط لا يظهر إلا بعد جاهزية الخدمة</div>
        </article>

        <article className="panel terminal-panel wide">
          <div className="terminal-head">
            <div><div className="eyebrow">مراقبة مباشرة</div><h2>Terminal / سجل التشغيل</h2><p className="muted">كل ما يطبعه Harness أثناء الإقلاع والتشغيل يظهر هون تلقائيًا.</p></div>
            <div className="terminal-controls">
              <button className="ghost" onClick={() => setAutoScroll(value => !value)}>{autoScroll ? "إيقاف النزول التلقائي" : "النزول لآخر سطر"}</button>
              <button className="ghost" onClick={() => setLogs([])}>مسح العرض</button>
              <button className="ghost" onClick={() => setTerminalOpen(value => !value)}>{terminalOpen ? "طيّ الطرفية" : "فتح الطرفية"}</button>
            </div>
          </div>
          {terminalOpen && <div className="terminal-window" role="log" aria-live="polite">
            <div className="terminal-bar"><span><i /> <i /> <i /></span><span>runtime — live output</span><span>{logs.length} سطر</span></div>
            <div className="terminal-body">
              {logs.length === 0 ? <div className="terminal-empty">بانتظار السجلات… اضغط «تشغيل Harness» لمتابعة الإقلاع.</div> : logs.map(line => (
                <div className={"terminal-line " + (line.stream === "stderr" || line.stream === "error" ? "terminal-error" : line.stream === "system" ? "terminal-system" : "")} key={line.id}>
                  <time>{new Date(line.time).toLocaleTimeString("ar", { hour12: false })}</time><b>{line.stream}</b><span>{line.text}</span>
                </div>
              ))}
              <div ref={terminalEnd} />
            </div>
          </div>}
          <div className="terminal-note">الطرفية للعرض والمراقبة فقط؛ أوامر النظام المباشرة غير مفعّلة لحماية الخادم.</div>
        </article>

        <article className="panel">
          <div className="eyebrow">الأمان</div><h2>وصول خاص</h2>
          <p className="muted">التحكم يمر عبر جلسة محمية، ومفتاح runtime يبقى على الخادم ولا يصل إلى المتصفح.</p>
          <div className="secure-line"><i /> التحقق من الجلسة مفعّل</div>
        </article>
        <article className="panel">
          <div className="eyebrow">الاتصال</div><h2>{connected ? "المتحكم متصل" : "بانتظار الاتصال"}</h2>
          <p className="muted">{connected ? "خادم التحكم يستجيب ويمكن إرسال أوامر التشغيل والإيقاف." : "تحقق من نشر خدمة Render وإعدادات الربط."}</p>
          <div className="panel-foot"><span>حالة الاتصال</span><strong>{connected ? "متصل" : "غير متصل"}</strong></div>
        </article>
      </section>
      <footer>مساحة خاصة <span>•</span> DEEPSEEK HARNESS</footer>
    </main>
  );
}
