import { NextRequest, NextResponse } from "next/server";
import { verifyDashboardSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyDashboardSession(request.cookies.get("dsh_session")?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = process.env.HARNESS_CONTROL_URL;
  const token = process.env.HARNESS_CONTROL_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ logs: [], latestId: 0, connected: false }, { status: 503 });
  }
  try {
    const after = request.nextUrl.searchParams.get("after") || "0";
    const response = await fetch(new URL("/control/logs?after=" + encodeURIComponent(after), base), {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      redirect: "error"
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Runtime returned " + response.status);
    return NextResponse.json({ ...data, connected: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ logs: [], latestId: 0, connected: false, error: "Could not read runtime logs." }, { status: 502 });
  }
}
