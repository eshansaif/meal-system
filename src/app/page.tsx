import { redirect } from "next/navigation";
import { getOptionalSession, homeFor } from "@/lib/serverSession";

// Resolved entirely on the server — no client fetch, no flash of "Loading…".
export default async function Home() {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  redirect(homeFor(session.role));
}
