"use client";

import { useEffect, useRef, useState } from "react";

type Status = { connected?: boolean; running?: boolean; state: string; message?: string; error?: string; launchUrl?: string | null };
type LogLine = { id: number; instanceId?: string; time: string; stream: string; text: string };
const LOG_CACHE_KEY = "dsh_terminal_logs_v1";

function sanitizeTerminalText(value: unknown): string {
  return String(value ?? "")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [مخفي]")
    .replace(/([?&](?:token|access_token|api_key|apikey|secret|key|auth|code)=)[^&\s"'<>]+/gi, "$1[مخفي]")
    .replace(/\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|authorization)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1[مخفي]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[رابط مخفي]");
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const latestLogId = useRef(0);
  const runtimeInstanceId = useRef<string | null>(null);
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
      const readLogs = async (after: number) => {
        const response = await fetch("/api/control/logs?after=" + after, { cache: "no-store" });
        if (response.status === 401) { window.location.replace("/login"); return null; }
        if (!response.ok) return null;
        return await response.json();
      };

      let data = await readLogs(latestLogId.current);
      if (!data) return;
      const nextInstanceId = typeof data.instanceId === "string" ? data.instanceId : "legacy";
      if (runtimeInstanceId.current && runtimeInstanceId.current !== nextInstanceId) {
        latestLogId.current = 0;
        data = await readLogs(0);
        if (!data) return;
      }
      runtimeInstanceId.current = nextInstanceId;

      if (Array.isArray(data.logs) && data.logs.length) {
        const incoming = data.logs.map((item: LogLine) => ({
          ...item,
          instanceId: nextInstanceId,
          text: sanitizeTerminalText(item.text)
        }));
        setLogs(previous => {
          const known = new Set(previous.map(item => (item.instanceId ?? "legacy") + ":" + item.id));
          return [...previous, ...incoming.filter((item: LogLine) => !known.has((item.instanceId ?? "legacy") + ":" + item.id))].slice(-250);
        });
      }
      if (typeof data.latestId === "number") latestLogId.current = data.latestId;
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
    try {
      const cached = localStorage.getItem(LOG_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setLogs(parsed.filter(item => item && typeof item.id === "number").slice(-250).map((item: LogLine) => ({
            ...item,
            text: sanitizeTerminalText(item.text)
          })));
        }
      }
    } catch {
      // Ignore a damaged or unavailable local cache.
    }
    setCacheLoaded(true);
    void refresh();
    void refreshLogs();
    const id = window.setInterval(() => {
      void refresh();
      void refreshLogs();
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!cacheLoaded) return;
    try {
      const safeLogs = logs.slice(-250).map(item => ({ ...item, text: sanitizeTerminalText(item.text) }));
      localStorage.setItem(LOG_CACHE_KEY, JSON.stringify(safeLogs));
    } catch {
      // The live terminal continues working if browser storage is unavailable.
    }
  }, [logs, cacheLoaded]);

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
          ) : <div className="link-placeholder">{state === "starting" ? "بانتظار اكتمال التشغيل…" : "الرابط غير متاح حاليًا؛ شغّل Harness للحصول على رابط جديد."}</div>}
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
                <div className={"terminal-line " + (line.stream === "stderr" || line.stream === "error" ? "terminal-error" : line.stream === "system" ? "terminal-system" : "")} key={(line.instanceId ?? "legacy") + ":" + line.id}>
                  <time>{new Date(line.time).toLocaleTimeString("ar", { hour12: false })}</time><b>{line.stream}</b><span>{line.text}</span>
                </div>
              ))}
              <div ref={terminalEnd} />
            </div>
          </div>}
          <div className="terminal-note">الطرفية للعرض والمراقبة فقط؛ أوامر النظام المباشرة غير مفعّلة لحماية الخادم. تُحفظ آخر 250 سطراً محلياً على هذا المتصفح، مع إخفاء الروابط والرموز السرية.</div>
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
