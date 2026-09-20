import { redirect } from "next/navigation";
import { getOptionalSession, homeFor } from "@/lib/serverSession";
import LoginForm from "./LoginForm";

export default async function Page() {
  const session = await getOptionalSession();
  if (session) redirect(homeFor(session.role));
  return <LoginForm />;
}
