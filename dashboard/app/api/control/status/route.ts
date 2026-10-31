import { NextRequest, NextResponse } from "next/server";
import { verifyDashboardSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyDashboardSession(request.cookies.get("dsh_session")?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const base = process.env.HARNESS_CONTROL_URL;
  const token = process.env.HARNESS_CONTROL_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ connected: false, state: "not_configured", message: "The private runtime has not been connected yet." }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(new URL("/control/status", base), {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      redirect: "error"
    });
    if (!response.ok) throw new Error("Runtime returned " + response.status);
    return NextResponse.json({ connected: true, ...(await response.json()) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ connected: false, state: "unreachable", message: "The runtime is not reachable right now." }, { headers: { "Cache-Control": "no-store" } });
  }
}
