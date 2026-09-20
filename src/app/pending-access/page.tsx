import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/serverSession";
import PendingAccessClient from "./PendingAccessClient";

/**
 * Landing spot for accounts whose role has no dedicated portal yet (today
 * that's only CATERING — see README "What's included vs. simplified").
 * Exists so such an account gets a clear, honest message instead of being
 * bounced between /login and /admin/dashboard in a redirect loop.
 */
export default async function Page() {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  return <PendingAccessClient session={session} />;
}
