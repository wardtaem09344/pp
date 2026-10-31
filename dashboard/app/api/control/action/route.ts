import { NextRequest, NextResponse } from "next/server";
import { verifyDashboardSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!verifyDashboardSession(request.cookies.get("dsh_session")?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const token = process.env.HARNESS_CONTROL_TOKEN;
  const base = process.env.HARNESS_CONTROL_URL;
  if (!token || !base) {
    return NextResponse.json({ error: "Runtime is not configured." }, { status: 503 });
  }

  let action: unknown;
  try { action = (await request.json()).action; } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (action !== "start" && action !== "stop") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  try {
    const response = await fetch(new URL(`/control/${action}`, base), {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(55000)
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach the runtime controller." }, { status: 502 });
  }
}
