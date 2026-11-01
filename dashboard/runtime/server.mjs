import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { timingSafeEqual, randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 10000);
const APP_PORT = Number(process.env.HARNESS_APP_PORT || 3080);
const TOKEN = process.env.CONTROL_TOKEN || "";
const INSTANCE_ID = randomUUID();
const PUBLIC_URL = process.env.RUNTIME_PUBLIC_URL || "https://deepseek-harness-runtime.onrender.com/";
const PUBLIC_HOST = new URL(PUBLIC_URL).host;
const APP_HOST = "127.0.0.1";
const WORKSPACE = "/app/deepseek-harness-source";
let child = null;
let state = "stopped";
let lastError = null;
let launchUrl = null;
let launchBuffer = "";
let logSequence = 0;
const terminalLogs = [];

function redactSecrets(value) {
  return String(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:token|access_token|api_key|apikey|secret|key|auth|code)=)[^&\\s"'<>]+/gi, "$1[REDACTED]")
    .replace(/\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|authorization)\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,;]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, "[REDACTED]")
    .replace(/https?:\\/\\/[^\\s"'<>]+/gi, "[URL REDACTED]");
}
function addLog(stream, chunk) {
  const lines = redactSecrets(chunk.toString()).replace(/\r/g, "").split("\n");
  for (const line of lines) {
    if (!line) continue;
    terminalLogs.push({ id: ++logSequence, instanceId: INSTANCE_ID, time: new Date().toISOString(), stream, text: line });
  }
  if (terminalLogs.length > 400) terminalLogs.splice(0, terminalLogs.length - 400);
}
function authorized(req) {
  const header = req.headers.authorization || "";
  const supplied = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(TOKEN);
  return expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function send(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function status() {
  if (child && child.exitCode !== null) child = null;
  return {
    instanceId: INSTANCE_ID,
    state,
    running: state === "running",
    launchUrl: state === "running" ? launchUrl : null,
    message: lastError || (state === "running" ? "Harness web process is running." : state === "starting" ? "Harness is starting." : state === "error" ? "Harness failed to start." : "Harness is stopped.")
  };
}
function captureOutput(stream, chunk) {
  const value = chunk.toString();
  process.stdout.write("[harness] " + redactSecrets(value));
  addLog(stream, value);
  launchBuffer = (launchBuffer + value).slice(-12000);
  const matches = launchBuffer.match(/https:\/\/deepseek-harness-runtime\.onrender\.com\/[^\s"'<>]+/g);
  if (matches?.length) launchUrl = matches[matches.length - 1].replace(/[),.;]+$/, "");
}
async function waitForApp(proc) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error("Harness process exited during startup.");
    try {
      const response = await fetch("http://" + APP_HOST + ":" + APP_PORT + "/", { signal: AbortSignal.timeout(1500), redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Harness did not become ready within 90 seconds.");
}
function start() {
  if (child && child.exitCode === null) return status();
  state = "starting";
  lastError = null;
  launchUrl = null;
  launchBuffer = "";
  addLog("system", "Starting DeepSeek Harness…");
  const proc = spawn("dsh", ["web", "--no-open", "--public-url", PUBLIC_URL, "--trusted-host", PUBLIC_HOST], {
    env: { ...process.env, DSH_HOME: process.env.DSH_HOME || "/tmp/dsh-home" },
    stdio: ["ignore", "pipe", "pipe"],
    cwd: WORKSPACE,
    detached: true
  });
  child = proc;
  proc.stdout.on("data", chunk => captureOutput("stdout", chunk));
  proc.stderr.on("data", chunk => captureOutput("stderr", chunk));
  proc.on("exit", (code, signal) => {
    if (child === proc) {
      child = null;
      state = "stopped";
      addLog("system", "Harness process exited (code " + code + ", signal " + (signal || "none") + ").");
      if (code && code !== 0) lastError = "Harness exited with code " + code + " (signal " + (signal || "none") + ").";
    }
  });

  void (async () => {
    try {
      await waitForApp(proc);
      if (child === proc) {
        state = "running";
        lastError = null;
        addLog("system", "Harness web interface is ready.");
      }
    } catch (error) {
      if (child === proc) {
        try { process.kill(-proc.pid, "SIGTERM"); } catch {}
        child = null;
        state = "error";
        lastError = error instanceof Error ? error.message : "Startup failed.";
        addLog("error", lastError);
      }
    }
  })();
  return status();
}
function stop() {
  if (!child || child.exitCode !== null) {
    child = null;
    state = "stopped";
    launchUrl = null;
    addLog("system", "Harness is already stopped.");
    return status();
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  child = null;
  state = "stopped";
  lastError = null;
  launchUrl = null;
  addLog("system", "Stop requested for Harness.");
  return status();
}
function proxyHttp(req, res) {
  if (!child || state !== "running") {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    return res.end("DeepSeek Harness is stopped. Start it from the private dashboard.");
  }
  const upstream = http.request({
    hostname: APP_HOST,
    port: APP_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: req.headers.host || PUBLIC_HOST }
  }, response => {
    const headers = { ...response.headers };
    const cookies = headers["set-cookie"];
    if (cookies) headers["set-cookie"] = cookies.map(cookie => /;\s*secure(?:;|$)/i.test(cookie) ? cookie : cookie + "; Secure");
    res.writeHead(response.statusCode || 502, headers);
    response.pipe(res);
  });
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Harness web process is unavailable.");
  });
  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname.startsWith("/control/")) {
    if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });
    if (url.pathname === "/control/status" && req.method === "GET") return send(res, 200, status());
    if (url.pathname === "/control/logs" && req.method === "GET") {
      const after = Number(url.searchParams.get("after") || 0);
      return send(res, 200, { instanceId: INSTANCE_ID, logs: terminalLogs.filter(item => item.id > after).slice(-200), latestId: logSequence });
    }
    if (url.pathname === "/control/start" && req.method === "POST") {
      try { return send(res, 200, start()); }
      catch (error) { return send(res, 503, { ...status(), error: error instanceof Error ? error.message : "Startup failed." }); }
    }
    if (url.pathname === "/control/stop" && req.method === "POST") return send(res, 200, stop());
    if (url.pathname === "/control/restart" && req.method === "POST") {
      stop();
      await new Promise(resolve => setTimeout(resolve, 1800));
      return send(res, 200, start());
    }
    return send(res, 404, { error: "Not found" });
  }
  return proxyHttp(req, res);
});
server.on("upgrade", (req, socket, head) => {
  if (!child || state !== "running") return socket.destroy();
  const upstream = net.connect(APP_PORT, APP_HOST, () => {
    upstream.write(req.method + " " + req.url + " HTTP/" + req.httpVersion + "\r\n");
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) upstream.write(key + ": " + (Array.isArray(value) ? value.join(", ") : value) + "\r\n");
    }
    upstream.write("\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
server.listen(PORT, "0.0.0.0", () => console.log("Runtime controller listening on " + PORT));
process.on("SIGTERM", () => { stop(); server.close(() => process.exit(0)); });
process.on("SIGINT", () => { stop(); server.close(() => process.exit(0)); });
