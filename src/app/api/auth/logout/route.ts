import { clearSessionCookie } from "@/lib/auth";
import { ok, withRoute } from "@/lib/api";

export const POST = withRoute(async () => {
  clearSessionCookie();
  return ok(null, "Logged out");
});
