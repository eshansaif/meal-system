import { requireUser } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";

export const GET = withRoute(async () => {
  const user = await requireUser();
  if (!user) return fail("Not authenticated", "UNAUTHENTICATED", 401);
  return ok({
    role: user.role,
    email: user.email,
    name: user.employee?.name ?? user.email,
    employeeId: user.employee?.id ?? null
  });
});
