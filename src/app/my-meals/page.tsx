import { getSessionOrRedirect } from "@/lib/serverSession";
import MyMealsClient from "./MyMealsClient";

export default async function Page() {
  const session = await getSessionOrRedirect(["EMPLOYEE"]);
  return <MyMealsClient session={session} />;
}
