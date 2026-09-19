import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { todayInOrgTz, isPastCutoff } from "@/lib/dates";

/** GET /api/meal-response/today?mealTypeId=  — today's status for the logged-in employee. */
export const GET = withRoute(async (req: Request) => {
  const user = await requireRole("EMPLOYEE", "SUPER_ADMIN", "HR_ADMIN");
  if (!user.employee) throw new ApiError("Only employee accounts have a meal response", "NOT_AN_EMPLOYEE", 400);

  const { searchParams } = new URL(req.url);
  const mealTypeId = searchParams.get("mealTypeId");
  if (!mealTypeId) throw new ApiError("mealTypeId is required", "VALIDATION_ERROR", 422);

  const mealType = await prisma.mealType.findUniqueOrThrow({ where: { id: mealTypeId } });
  const today = todayInOrgTz();

  const holiday = await prisma.calendarException.findUnique({ where: { date: today } });

  const response = await prisma.mealResponse.findUnique({
    where: { employeeId_mealTypeId_date: { employeeId: user.employee.id, mealTypeId, date: today } }
  });

  const locked = isPastCutoff(today, mealType.cutoffTime) || holiday?.type === "HOLIDAY";

  return ok({
    date: today,
    status: response?.status ?? "NO_RESPONSE",
    isLocked: locked || response?.isLocked || false,
    respondedAt: response?.respondedAt ?? null,
    cutoffTime: mealType.cutoffTime,
    isHoliday: holiday?.type === "HOLIDAY",
    holidayLabel: holiday?.type === "HOLIDAY" ? holiday.label : null
  });
});
