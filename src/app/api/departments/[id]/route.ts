import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { departmentSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const PATCH = withRoute(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = departmentSchema.partial().parse(await req.json());
  const before = await prisma.department.findUnique({ where: { id: params.id } });
  if (!before) throw new ApiError("Department not found", "NOT_FOUND", 404);
  const updated = await prisma.department.update({ where: { id: params.id }, data: body });
  await writeAudit({ userId: user.id, action: "DEPARTMENT_UPDATE", entity: "Department", entityId: params.id, previousValue: before, newValue: updated });
  return ok(updated, "Department updated");
});

export const DELETE = withRoute(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireRole("SUPER_ADMIN");
  const before = await prisma.department.findUnique({ where: { id: params.id }, include: { _count: { select: { employees: true } } } });
  if (!before) throw new ApiError("Department not found", "NOT_FOUND", 404);
  if (before._count.employees > 0) {
    // Historical references must never be hard-deleted — deactivate instead.
    const updated = await prisma.department.update({ where: { id: params.id }, data: { isActive: false } });
    await writeAudit({ userId: user.id, action: "DEPARTMENT_DEACTIVATE", entity: "Department", entityId: params.id, previousValue: before, newValue: updated });
    return ok(updated, "Department has employee history, so it was deactivated instead of deleted");
  }
  await prisma.department.delete({ where: { id: params.id } });
  await writeAudit({ userId: user.id, action: "DEPARTMENT_DELETE", entity: "Department", entityId: params.id, previousValue: before });
  return ok(null, "Department deleted");
});
