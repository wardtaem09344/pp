import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSession, sessionCookieName } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(sessionCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = process.env.HARNESS_CONTROL_URL;
  const token = process.env.HARNESS_CONTROL_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ connected: false, state: "not_configured", message: "The private runtime has not been connected yet." });
  }
  try {
    const response = await fetch(new URL("/control/status", base), {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("Runtime returned " + response.status);
    return NextResponse.json({ connected: true, ...(await response.json()) });
  } catch {
    return NextResponse.json({ connected: false, state: "unreachable", message: "The runtime is not reachable right now." });
  }
}
