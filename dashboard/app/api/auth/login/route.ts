import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const SESSION_SECONDS = 60 * 60 * 8;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

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

  const expectedHash = process.env.DASHBOARD_PASSWORD_SHA256;
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET;
  if (!expectedHash || !sessionSecret) {
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  }

  const actualHash = createHash("sha256").update(submitted, "utf8").digest("hex");
  if (!safeEqual(actualHash, expectedHash)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  attempts.delete(ip);
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_SECONDS * 1000 })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  const response = NextResponse.json({ ok: true });
  response.cookies.set("dsh_session", payload + "." + signature, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS
  });
  return response;
}
