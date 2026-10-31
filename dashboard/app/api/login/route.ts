import { NextResponse } from "next/server";
import { createSession, sessionCookieName } from "@/lib/session";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const configured = process.env.DASHBOARD_PASSWORD;
  if (!configured) return NextResponse.json({ error: "Dashboard password is not configured." }, { status: 503 });
  let body: { password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const supplied = Buffer.from(body.password ?? "");
  const expected = Buffer.from(configured);
  const valid = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  if (!valid) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });

  const session = createSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: session.maxAge
  });
  return response;
}
