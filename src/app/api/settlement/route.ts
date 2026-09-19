import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { recomputeSettlementsForMonth, computeAndSaveSettlement } from "@/lib/settlement";
import { currentSettlementMonth } from "@/lib/dates";
import { writeAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

/** GET /api/settlement?month=&departmentId=&status=&search=&page=&pageSize= — the monthly settlement table. */
export const GET = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE");
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || currentSettlementMonth();
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search")?.trim();
  const departmentId = searchParams.get("departmentId") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10)));

  const employeeFilter =
    user.role === "EMPLOYEE" ? { id: user.employee?.id } : { departmentId, ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { employeeCode: { contains: search, mode: "insensitive" as const } }
      ]
    } : {}) };

  const where: Prisma.SettlementWhereInput = {
    settlementMonth: month,
    ...(status ? { paymentStatus: status as any } : {}),
    employee: employeeFilter
  };

  const [total, settlements] = await Promise.all([
    prisma.settlement.count({ where }),
    prisma.settlement.findMany({
      where,
      include: { employee: { include: { department: true } } },
      orderBy: { employee: { name: "asc" } },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  const totals = await prisma.settlement.aggregate({
    where: { settlementMonth: month, employee: user.role === "EMPLOYEE" ? { id: user.employee?.id } : {} },
    _sum: { mealCost: true, paymentsThisMonth: true, outstanding: true, credit: true },
    _count: true
  });

  return ok({ settlements, total, page, pageSize, totalPages: Math.ceil(total / pageSize), totals });
});

/** POST /api/settlement/recompute — recomputes the whole month (or one employee). HR/Admin only. */
export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = await req.json().catch(() => ({}));
  const month = body.month || currentSettlementMonth();

  const result = body.employeeId
    ? [await computeAndSaveSettlement(body.employeeId, month)]
    : await recomputeSettlementsForMonth(month);

  await writeAudit({ userId: user.id, action: "SETTLEMENT_RECOMPUTE", entity: "Settlement", newValue: { month, count: result.length } });

  return ok(result, `Recomputed ${result.length} settlement(s) for ${month}`);
});
