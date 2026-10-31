import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
