import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { todayInOrgTz, normalizeDate, currentSettlementMonth } from "@/lib/dates";

/** GET /api/dashboard/hr?mealTypeId=&date= */
export const GET = withRoute(async (req: Request) => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const { searchParams } = new URL(req.url);
  const mealTypeId = searchParams.get("mealTypeId");
  const date = searchParams.get("date") ? normalizeDate(searchParams.get("date")!) : todayInOrgTz();

  const mealType = mealTypeId
    ? await prisma.mealType.findUnique({ where: { id: mealTypeId } })
    : await prisma.mealType.findFirst({ where: { code: "LUNCH" } });

  const totalActive = await prisma.employee.count({ where: { status: "ACTIVE" } });

  const [taking, notTaking, responses, consumptions] = await Promise.all([
    prisma.mealResponse.count({ where: { mealTypeId: mealType!.id, date, status: "TAKING" } }),
    prisma.mealResponse.count({ where: { mealTypeId: mealType!.id, date, status: "NOT_TAKING" } }),
    prisma.mealResponse.count({ where: { mealTypeId: mealType!.id, date } }),
    prisma.mealConsumption.findMany({ where: { mealTypeId: mealType!.id, date } })
  ]);

  const noResponse = totalActive - responses;
  const served = consumptions.filter((c) => c.servingStatus === "SERVED").length;
  const extra = consumptions.filter((c) => c.servingStatus === "EXTRA").length;
  const notServed = consumptions.filter((c) => c.servingStatus === "NOT_SERVED").length;
  const todaysMealCost = consumptions.reduce((s, c) => s + Number(c.chargeAmount), 0);

  const month = currentSettlementMonth();
  const collectedToday = await prisma.payment.aggregate({
    where: { paymentDate: { gte: date, lt: new Date(date.getTime() + 86400000) }, status: "ACTIVE" },
    _sum: { amount: true }
  });

  const monthTotals = await prisma.settlement.aggregate({
    where: { settlementMonth: month },
    _sum: { outstanding: true, mealCost: true, paymentsThisMonth: true, credit: true }
  });

  return ok({
    date,
    mealType: mealType ? { id: mealType.id, name: mealType.name, cutoffTime: mealType.cutoffTime } : null,
    operational: {
      totalActiveEmployees: totalActive,
      taking,
      notTaking,
      noResponse,
      expectedMeals: taking,
      served,
      extra,
      notServed
    },
    financial: {
      todaysMealCost,
      collectedToday: Number(collectedToday._sum.amount || 0),
      monthOutstanding: Number(monthTotals._sum.outstanding || 0),
      monthMealCost: Number(monthTotals._sum.mealCost || 0),
      monthCollected: Number(monthTotals._sum.paymentsThisMonth || 0)
    }
  });
});
