import { getSessionOrRedirect } from "@/lib/serverSession";
import SettlementClient from "./SettlementClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN", "HR_ADMIN"]);
  return <SettlementClient session={session} />;
}
