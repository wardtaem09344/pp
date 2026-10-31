import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 10000);
const APP_PORT = Number(process.env.HARNESS_APP_PORT || 3081);
const TOKEN = process.env.CONTROL_TOKEN || "";
const ROOT = "/app/deepseek-harness-source";
const APP_HOST = "127.0.0.1";
let child = null;
let state = "stopped";
let lastError = null;

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
  return { state, running: state === "running", message: lastError || (state === "running" ? "Harness web process is running." : state === "starting" ? "Harness is starting." : "Harness is stopped.") };
}
async function waitForApp(proc) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error("Harness process exited during startup.");
    try {
      const response = await fetch(`http://${APP_HOST}:${APP_PORT}/`, { signal: AbortSignal.timeout(1500), redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Harness did not become ready within 90 seconds.");
}
async function start() {
  if (child && child.exitCode === null) return status();
  state = "starting";
  lastError = null;
  const proc = spawn("pnpm", ["--dir", ROOT, "dsh", "web", "--no-open", "--port", String(APP_PORT)], {
    env: { ...process.env, DSH_HOME: process.env.DSH_HOME || "/tmp/dsh-home" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true
  });
  child = proc;
  proc.stdout.on("data", chunk => process.stdout.write("[harness] " + chunk));
  proc.stderr.on("data", chunk => process.stderr.write("[harness] " + chunk));
  proc.on("exit", (code, signal) => {
    if (child === proc) {
      child = null;
      state = "stopped";
      if (code && code !== 0) lastError = `Harness exited with code ${code} (signal ${signal || "none"}).`;
    }
  });
  try {
    await waitForApp(proc);
    state = "running";
    return status();
  } catch (error) {
    try { process.kill(-proc.pid, "SIGTERM"); } catch {}
    child = null;
    state = "error";
    lastError = error instanceof Error ? error.message : "Startup failed.";
    throw error;
  }
}
function stop() {
  if (!child || child.exitCode !== null) {
    child = null;
    state = "stopped";
    return status();
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  child = null;
  state = "stopped";
  lastError = null;
  return status();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname.startsWith("/control/")) {
    if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });
    if (url.pathname === "/control/status" && req.method === "GET") return send(res, 200, status());
    if (url.pathname === "/control/start" && req.method === "POST") {
      try { return send(res, 200, await start()); }
      catch (error) { return send(res, 503, { ...status(), error: error instanceof Error ? error.message : "Startup failed." }); }
    }
    if (url.pathname === "/control/stop" && req.method === "POST") return send(res, 200, stop());
    return send(res, 404, { error: "Not found" });
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end("DeepSeek Harness runtime controller is online. Manage it from the private dashboard.");
});
server.on("upgrade", (req, socket, head) => {
  if (!child || state !== "running") return socket.destroy();
  const upstream = net.connect(APP_PORT, APP_HOST, () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) upstream.write(`${key}: ${Array.isArray(value) ? value.join(", ") : value}\r\n`);
    }
    upstream.write("\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
server.listen(PORT, "0.0.0.0", () => console.log(`Runtime controller listening on ${PORT}`));
process.on("SIGTERM", () => { stop(); server.close(() => process.exit(0)); });
process.on("SIGINT", () => { stop(); server.close(() => process.exit(0)); });
