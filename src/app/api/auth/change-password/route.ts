import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, withRoute } from "@/lib/api";
import { requireUser, verifyPassword, hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(6, "New password must be at least 6 characters")
});

/**
 * POST /api/auth/change-password — available to every authenticated role
 * (Employee, HR/Admin, Super Admin, Catering). Requires the current
 * password to be re-entered and verified before setting a new one; this is
 * never exposed as an admin-reset-someone-else's-password endpoint.
 */
export const POST = withRoute(async (req: Request) => {
  const user = await requireUser();
  if (!user) return fail("Not authenticated", "UNAUTHENTICATED", 401);

  const body = bodySchema.parse(await req.json());

  const valid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!valid) return fail("Current password is incorrect", "INVALID_CURRENT_PASSWORD", 401);

  if (body.newPassword === body.currentPassword) {
    return fail("New password must be different from the current password", "SAME_PASSWORD", 422);
  }

  const passwordHash = await hashPassword(body.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await writeAudit({ userId: user.id, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id });

  return ok(null, "Password updated successfully");
});
