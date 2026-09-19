import { getSessionOrRedirect } from "@/lib/serverSession";
import AuditClient from "./AuditClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN"]);
  return <AuditClient session={session} />;
}
