import { getSessionOrRedirect } from "@/lib/serverSession";
import EmployeesClient from "./EmployeesClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["SUPER_ADMIN", "HR_ADMIN"]);
  return <EmployeesClient session={session} />;
}
