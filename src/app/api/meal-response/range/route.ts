import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { normalizeDate, isPastCutoff } from "@/lib/dates";
import { isWorkingDay } from "@/lib/orgSettings";

/**
 * GET /api/meal-response/range?mealTypeId=&from=&to= — per-day status for
 * the logged-in employee across a date range. Powers the "This Month's
 * Lunch Plan" list so they can see and cancel individual future days.
 */
export const GET = withRoute(async (req: Request) => {
  const user = await requireRole("EMPLOYEE");
  if (!user.employee) throw new ApiError("Only employee accounts have a meal plan", "NOT_AN_EMPLOYEE", 400);

  const { searchParams } = new URL(req.url);
  const mealTypeId = searchParams.get("mealTypeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!mealTypeId || !from || !to) throw new ApiError("mealTypeId, from and to are required", "VALIDATION_ERROR", 422);

  const mealType = await prisma.mealType.findUniqueOrThrow({ where: { id: mealTypeId } });
  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to);
  if (toDate.getTime() - fromDate.getTime() > 1000 * 60 * 60 * 24 * 93) {
    throw new ApiError("Range too large — please request 93 days or fewer", "RANGE_TOO_LARGE", 422);
  }

  const responses = await prisma.mealResponse.findMany({
    where: { employeeId: user.employee.id, mealTypeId, date: { gte: fromDate, lte: toDate } }
  });
  const byDate = new Map(responses.map((r) => [r.date.toISOString().slice(0, 10), r]));

  const days = [];
  for (let d = new Date(fromDate); d.getTime() <= toDate.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = new Date(d);
    const key = date.toISOString().slice(0, 10);
    const working = await isWorkingDay(date);
    const response = byDate.get(key);
    days.push({
      date: key,
      isWorkingDay: working,
      status: working ? response?.status ?? "NO_RESPONSE" : "NO_RESPONSE",
      isMonthlyDefault: response?.isMonthlyDefault ?? false,
      isLocked: working ? isPastCutoff(date, mealType.cutoffTime) || !!response?.isLocked : true
    });
  }

  return ok(days);
});
