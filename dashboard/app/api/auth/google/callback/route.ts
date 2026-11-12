import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleTokenResponse = { access_token?: string; error?: string };
type GoogleUser = { email?: string; email_verified?: boolean; name?: string };

function fail(request: NextRequest, reason: string) {
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent(reason), request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("google_oauth_state")?.value;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET;

  if (!code || !returnedState || !savedState || returnedState.length !== savedState.length) {
    return fail(request, "google_state_invalid");
  }
  const a = Buffer.from(returnedState);
  const b = Buffer.from(savedState);
  if (!timingSafeEqual(a, b)) return fail(request, "google_state_invalid");
  if (!clientId || !clientSecret || !sessionSecret) return fail(request, "google_not_configured");

  const redirectUri = new URL("/api/auth/google/callback", request.nextUrl.origin).toString();

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }),
      cache: "no-store"
    });
    const token = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !token.access_token) return fail(request, "google_exchange_failed");

    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: "Bearer " + token.access_token },
      cache: "no-store"
    });
    const user = await userResponse.json() as GoogleUser;
    if (!userResponse.ok || !user.email || user.email_verified !== true) {
      return fail(request, "google_email_unverified");
    }

    const expiresInMs = 8 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({
      exp: Date.now() + expiresInMs,
      provider: "google",
      email: user.email
    })).toString("base64url");
    const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
    const response = NextResponse.redirect(new URL("/", request.url));
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set("dsh_session", payload + "." + signature, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60
    });
    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: 0
    });
    return response;
  } catch {
    return fail(request, "google_login_failed");
  }
}
