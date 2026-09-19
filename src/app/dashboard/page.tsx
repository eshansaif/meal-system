import { getSessionOrRedirect } from "@/lib/serverSession";
import DashboardClient from "./DashboardClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["EMPLOYEE"]);
  return <DashboardClient session={session} />;
}
