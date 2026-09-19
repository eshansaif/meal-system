import { getSessionOrRedirect } from "@/lib/serverSession";
import DailyRosterClient from "./DailyRosterClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN", "HR_ADMIN"]);
  return <DailyRosterClient session={session} />;
}
