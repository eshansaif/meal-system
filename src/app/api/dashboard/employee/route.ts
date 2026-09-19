import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { currentSettlementMonth } from "@/lib/dates";
import { getLifetimeFinancials } from "@/lib/settlement";

export const GET = withRoute(async () => {
  const user = await requireRole("EMPLOYEE");
  if (!user.employee) throw new ApiError("Not an employee account", "NOT_AN_EMPLOYEE", 400);

  const month = currentSettlementMonth();
  const [settlement, recentHistory, lifetime] = await Promise.all([
    prisma.settlement.findUnique({
      where: { employeeId_settlementMonth: { employeeId: user.employee.id, settlementMonth: month } }
    }),
    prisma.mealConsumption.findMany({
      where: { employeeId: user.employee.id },
      include: { mealType: true },
      orderBy: { date: "desc" },
      take: 10
    }),
    getLifetimeFinancials(user.employee.id)
  ]);

  return ok({
    month,
    monthlySummary: settlement ?? {
      mealsServed: 0,
      mealCost: 0,
      paymentsThisMonth: 0,
      outstanding: 0,
      credit: 0,
      paymentStatus: "UNPAID"
    },
    lifetime,
    recentHistory
  });
});
