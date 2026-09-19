import { getSessionOrRedirect } from "@/lib/serverSession";
import PaymentsClient from "./PaymentsClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN", "HR_ADMIN"]);
  return <PaymentsClient session={session} />;
}
