import { getSessionOrRedirect } from "@/lib/serverSession";
import SettingsClient from "./SettingsClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN"]);
  return <SettingsClient session={session} />;
}
