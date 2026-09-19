import { prisma } from "./db";
import { normalizeDate } from "./dates";

export async function getDailyReport(mealTypeId: string, date: Date) {
  const d = normalizeDate(date);
  const totalActive = await prisma.employee.count({ where: { status: "ACTIVE" } });
  const [responses, consumptions, holiday] = await Promise.all([
    prisma.mealResponse.findMany({ where: { mealTypeId, date: d } }),
    prisma.mealConsumption.findMany({ where: { mealTypeId, date: d } }),
    prisma.calendarException.findUnique({ where: { date: d } })
  ]);

  const requested = responses.filter((r) => r.status === "TAKING").length;
  const notRequested = responses.filter((r) => r.status === "NOT_TAKING").length;
  const noResponse = totalActive - responses.length;
  const served = consumptions.filter((c) => c.servingStatus === "SERVED").length;
  const extra = consumptions.filter((c) => c.servingStatus === "EXTRA").length;
  const notServed = consumptions.filter((c) => c.servingStatus === "NOT_SERVED").length;
  const mealCost = consumptions.reduce((s, c) => s + Number(c.chargeAmount), 0);

  const collected = await prisma.payment.aggregate({
    where: { paymentDate: { gte: d, lt: new Date(d.getTime() + 86400000) }, status: "ACTIVE" },
    _sum: { amount: true }
  });

  return {
    date: d,
    isHoliday: holiday?.type === "HOLIDAY",
    activeEmployees: totalActive,
    requested,
    notRequested,
    noResponse,
    expectedMeals: requested,
    served,
    notServed,
    extra,
    mealCost,
    collected: Number(collected._sum.amount || 0)
  };
}

/** Employee-wise monthly report rows (one row per employee) — the source of truth also used by the Excel/PDF export and by HR "Employee Meal Accounts". */
export async function getMonthlyReport(month: string, departmentId?: string) {
  const employees = await prisma.employee.findMany({
    where: { ...(departmentId ? { departmentId } : {}) },
    include: {
      department: true,
      mealConsumptions: { where: { settlementMonth: month } },
      mealResponses: { where: { date: { gte: new Date(`${month}-01T00:00:00.000Z`), lt: nextMonthStart(month) } } }
    },
    orderBy: { name: "asc" }
  });

  const settlements = await prisma.settlement.findMany({ where: { settlementMonth: month } });
  const settlementByEmployee = new Map(settlements.map((s) => [s.employeeId, s]));

  const rows = employees.map((e) => {
    const requested = e.mealResponses.filter((r) => r.status === "TAKING").length;
    const notTaken = e.mealResponses.filter((r) => r.status === "NOT_TAKING").length;
    const noResponse = e.mealResponses.filter((r) => r.status === "NO_RESPONSE").length;
    const served = e.mealConsumptions.filter((c) => c.servingStatus === "SERVED" || c.servingStatus === "EXTRA").length;
    const notServed = e.mealConsumptions.filter((c) => c.servingStatus === "NOT_SERVED").length;
    const s = settlementByEmployee.get(e.id);

    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      department: e.department.name,
      eligibleDays: e.mealResponses.length,
      requested,
      served,
      notServed,
      notTaken,
      noResponse,
      mealCost: Number(s?.mealCost ?? 0),
      paid: Number(s?.paymentsThisMonth ?? 0),
      outstanding: Number(s?.outstanding ?? 0),
      credit: Number(s?.credit ?? 0),
      paymentStatus: s?.paymentStatus ?? "UNPAID"
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      requested: acc.requested + r.requested,
      served: acc.served + r.served,
      notServed: acc.notServed + r.notServed,
      mealCost: acc.mealCost + r.mealCost,
      paid: acc.paid + r.paid,
      outstanding: acc.outstanding + r.outstanding
    }),
    { requested: 0, served: 0, notServed: 0, mealCost: 0, paid: 0, outstanding: 0 }
  );

  return { rows, totals, month };
}

export async function getDepartmentReport(month: string) {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const results = [];
  for (const dept of departments) {
    const { rows } = await getMonthlyReport(month, dept.id);
    if (rows.length === 0) continue;
    const totalEmployees = rows.length;
    const requested = rows.reduce((s, r) => s + r.requested, 0);
    const served = rows.reduce((s, r) => s + r.served, 0);
    const notServed = rows.reduce((s, r) => s + r.notServed, 0);
    const mealCost = rows.reduce((s, r) => s + r.mealCost, 0);
    const paid = rows.reduce((s, r) => s + r.paid, 0);
    const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);
    results.push({
      department: dept.name,
      totalEmployees,
      requested,
      served,
      notServed,
      mealCost,
      paid,
      outstanding,
      consumptionPercentage: requested > 0 ? Math.round((served / requested) * 1000) / 10 : 0
    });
  }
  return results;
}

export async function getEmployeeBill(employeeId: string, month: string) {
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: { department: true }
  });
  const [consumptions, payments, settlement] = await Promise.all([
    prisma.mealConsumption.findMany({
      where: { employeeId, settlementMonth: month },
      include: { mealType: true },
      orderBy: { date: "asc" }
    }),
    prisma.payment.findMany({
      where: { employeeId, settlementMonth: month, status: "ACTIVE" },
      orderBy: { paymentDate: "asc" }
    }),
    prisma.settlement.findUnique({ where: { employeeId_settlementMonth: { employeeId, settlementMonth: month } } })
  ]);

  return { employee, consumptions, payments, settlement, month };
}

function nextMonthStart(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
}
