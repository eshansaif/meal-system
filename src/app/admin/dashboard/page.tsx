import { getSessionOrRedirect } from "@/lib/serverSession";
import HrDashboardClient from "./HrDashboardClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN", "HR_ADMIN"]);
  return <HrDashboardClient session={session} />;
}
