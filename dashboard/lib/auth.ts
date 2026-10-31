import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyDashboardSession(token: string | undefined, secret = process.env.DASHBOARD_SESSION_SECRET): boolean {
  if (!token || !secret) return false;
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(session.exp) && session.exp > Date.now();
  } catch {
    return false;
  }
}
