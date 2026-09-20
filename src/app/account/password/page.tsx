import { getSessionOrRedirect } from "@/lib/serverSession";
import ChangePasswordClient from "./ChangePasswordClient";

// No role restriction — every authenticated account type can change its own password.
export default async function Page() {
  const session = await getSessionOrRedirect();
  return <ChangePasswordClient session={session} />;
}
