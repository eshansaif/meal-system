import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { employeeUpdateSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";

export const GET = withRoute(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  // Employees may only view their own record; HR/Admin may view any.
  if (user.role === "EMPLOYEE" && user.employee?.id !== params.id) {
    throw new ApiError("You can only view your own profile", "FORBIDDEN", 403);
  }

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { department: true, user: { select: { email: true, role: true, isActive: true } } }
  });
  if (!employee) throw new ApiError("Employee not found", "NOT_FOUND", 404);
  return ok(employee);
});

export const PATCH = withRoute(async (req: Request, { params }: { params: { id: string } }) => {
  const actingUser = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = employeeUpdateSchema.parse(await req.json());

  const before = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!before) throw new ApiError("Employee not found", "NOT_FOUND", 404);

  const data: any = { ...body };
  if (body.status === "INACTIVE" && before.status === "ACTIVE") {
    data.leavingDate = new Date();
  }
  if (body.status === "ACTIVE" && before.status === "INACTIVE") {
    data.leavingDate = null;
  }

  const updated = await prisma.employee.update({ where: { id: params.id }, data });

  // Deactivating the employee record also deactivates their login, but never
  // deletes it — historical meal/payment records must remain intact.
  if (body.status) {
    await prisma.user.update({ where: { id: before.userId }, data: { isActive: body.status === "ACTIVE" } });
  }

  await writeAudit({
    userId: actingUser.id,
    action: body.status === "INACTIVE" ? "EMPLOYEE_DEACTIVATE" : body.status === "ACTIVE" ? "EMPLOYEE_REACTIVATE" : "EMPLOYEE_UPDATE",
    entity: "Employee",
    entityId: params.id,
    previousValue: before,
    newValue: updated
  });

  return ok(updated, "Employee updated");
});
