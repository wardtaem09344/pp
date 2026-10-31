import { NextRequest, NextResponse } from "next/server";

const COOKIE = "dsh_session";

function decode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function validSession(token: string, secret: string): Promise<boolean> {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const data = new TextEncoder().encode(payload);
    return await crypto.subtle.verify("HMAC", key, decode(signature), data) &&
      Number(JSON.parse(new TextDecoder().decode(decode(payload))).exp) > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/api/auth/login" || path.startsWith("/_next/") || path === "/favicon.ico") {
    return NextResponse.next();
  }

  const secret = process.env.DASHBOARD_SESSION_SECRET;
  const token = request.cookies.get(COOKIE)?.value;
  if (secret && token && await validSession(token, secret)) return NextResponse.next();

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|robots.txt|sitemap.xml).*)"]
};
