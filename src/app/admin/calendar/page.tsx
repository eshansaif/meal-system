import { getSessionOrRedirect } from "@/lib/serverSession";
import CalendarClient from "./CalendarClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN", "HR_ADMIN"]);
  return <CalendarClient session={session} />;
}
