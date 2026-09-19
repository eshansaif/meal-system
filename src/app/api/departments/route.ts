import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { departmentSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const GET = withRoute(async () => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE");
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } }
  });
  return ok(departments);
});

export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = departmentSchema.parse(await req.json());
  const dept = await prisma.department.create({ data: { name: body.name } });
  await writeAudit({ userId: user.id, action: "DEPARTMENT_CREATE", entity: "Department", entityId: dept.id, newValue: dept });
  return ok(dept, "Department created", 201);
});
