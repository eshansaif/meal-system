import { prisma } from "@/lib/db";
import { verifyPassword, signSession, setSessionCookie } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const POST = withRoute(async (req: Request) => {
  const body = loginSchema.parse(await req.json());

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
    include: { employee: true }
  });

  if (!user || !user.isActive) {
    return fail("Invalid email or password", "INVALID_CREDENTIALS", 401);
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    return fail("Invalid email or password", "INVALID_CREDENTIALS", 401);
  }

  const token = signSession({
    userId: user.id,
    role: user.role,
    email: user.email,
    employeeId: user.employee?.id ?? null
  });
  setSessionCookie(token);

  await writeAudit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });

  return ok(
    {
      role: user.role,
      email: user.email,
      name: user.employee?.name ?? user.email,
      employeeId: user.employee?.id ?? null
    },
    "Logged in successfully"
  );
});
