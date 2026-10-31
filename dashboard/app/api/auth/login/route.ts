import { NextRequest, NextResponse } from "next/server";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const SESSION_SECONDS = 60 * 60 * 8;

function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(expectedHex)) return false;
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 2048) return NextResponse.json({ error: "Request too large" }, { status: 413 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const record = attempts.get(ip);
  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((record.resetAt - now) / 1000)) }
    });
  }
  if (!record || record.resetAt <= now) attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else record.count += 1;

  let submitted = "";
  try {
    const body = await request.json();
    if (typeof body.password === "string" && body.password.length <= 256) submitted = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const storedPassword = process.env.DASHBOARD_PASSWORD_SCRYPT;
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET;
  if (!storedPassword || !sessionSecret) {
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  }

  let valid = false;
  try { valid = verifyPassword(submitted, storedPassword); } catch { valid = false; }
  if (!valid) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

  attempts.delete(ip);
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_SECONDS * 1000 })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set("dsh_session", payload + "." + signature, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS
  });
  return response;
}
