import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/serverSession";
import LoginForm from "./LoginForm";

export default async function Page() {
  const session = await getOptionalSession();
  if (session) redirect(session.role === "EMPLOYEE" ? "/dashboard" : "/admin/dashboard");
  return <LoginForm />;
}
