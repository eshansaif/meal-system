import { getSessionOrRedirect } from "@/lib/serverSession";
import ReportsClient from "./ReportsClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN", "HR_ADMIN"]);
  return <ReportsClient session={session} />;
}
