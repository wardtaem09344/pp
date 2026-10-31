import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { verifyDashboardSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  if (!verifyDashboardSession(cookieStore.get("dsh_session")?.value)) redirect("/login");
  return <Dashboard />;
}
