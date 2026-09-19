import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { servingUpdateSchema } from "@/lib/validation";
import { bulkSetServingStatus } from "@/lib/consumption";
import { computeAndSaveSettlement } from "@/lib/settlement";
import { normalizeDate, settlementMonthOf } from "@/lib/dates";
import { writeAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

/**
 * GET /api/serving?mealTypeId=&date=&search=&responseFilter=&servingFilter=&departmentId=&page=&pageSize=
 * Returns the daily roster: every active employee with their response +
 * consumption/serving status for the given date, joined and paginated.
 */
export const GET = withRoute(async (req: Request) => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN", "CATERING");
  const { searchParams } = new URL(req.url);
  const mealTypeId = searchParams.get("mealTypeId")!;
  const date = normalizeDate(searchParams.get("date") || new Date().toISOString());
  const search = searchParams.get("search")?.trim();
  const departmentId = searchParams.get("departmentId") || undefined;
  const responseFilter = searchParams.get("responseFilter") || undefined;
  const servingFilter = searchParams.get("servingFilter") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10)));

  const where: Prisma.EmployeeWhereInput = {
    status: "ACTIVE",
    ...(departmentId ? { departmentId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { employeeCode: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        department: true,
        mealResponses: { where: { mealTypeId, date } },
        mealConsumptions: { where: { mealTypeId, date } }
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  let rows = employees.map((e) => {
    const response = e.mealResponses[0];
    const consumption = e.mealConsumptions[0];
    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      department: e.department.name,
      responseStatus: response?.status ?? "NO_RESPONSE",
      responseTime: response?.respondedAt ?? null,
      servingStatus: consumption?.servingStatus ?? "PENDING",
      unitPrice: consumption?.unitPriceApplied ?? null,
      charge: consumption?.chargeAmount ?? 0,
      servedAt: consumption?.servedAt ?? null,
      remarks: consumption?.remarks ?? null
    };
  });

  if (responseFilter) rows = rows.filter((r) => r.responseStatus === responseFilter);
  if (servingFilter) rows = rows.filter((r) => r.servingStatus === servingFilter);

  return ok({ rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

/** POST /api/serving — bulk-update serving status for selected employees on a date/mealType. */
export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = servingUpdateSchema.parse(await req.json());
  const date = normalizeDate(body.date);

  const results = await bulkSetServingStatus(
    body.employeeIds.map((employeeId) => ({ employeeId, mealTypeId: body.mealTypeId, date })),
    body.servingStatus
  );

  await writeAudit({
    userId: user.id,
    action: "SERVING_STATUS_UPDATE",
    entity: "MealConsumption",
    newValue: { employeeIds: body.employeeIds, mealTypeId: body.mealTypeId, date, servingStatus: body.servingStatus },
    reason: body.remarks
  });

  // Keep the affected employees' monthly settlement snapshots in sync immediately.
  const month = settlementMonthOf(date);
  await Promise.all(body.employeeIds.map((id) => computeAndSaveSettlement(id, month)));

  return ok(results, `${results.length} record(s) updated`);
});
