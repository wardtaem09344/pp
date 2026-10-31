import { cookies } from "next/headers";
import Dashboard from "@/components/dashboard";
import { isValidSession, sessionCookieName } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const jar = await cookies();
  const authenticated = isValidSession(jar.get(sessionCookieName())?.value);
  return <Dashboard authenticated={authenticated} />;
}
