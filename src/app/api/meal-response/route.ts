import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { mealResponseSchema } from "@/lib/validation";
import { todayInOrgTz, isPastCutoff, normalizeDate } from "@/lib/dates";

/**
 * POST /api/meal-response — employee submits/modifies today's meal response.
 * Cutoff is enforced here, server-side, regardless of what the frontend
 * countdown shows. Uses upsert on the (employee, mealType, date) unique key
 * so duplicate/retried requests are idempotent and never create duplicate rows.
 */
export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("EMPLOYEE");
  if (!user.employee) throw new ApiError("Only employee accounts can submit a meal response", "NOT_AN_EMPLOYEE", 400);

  const body = mealResponseSchema.parse(await req.json());
  const date = body.date ? normalizeDate(body.date) : todayInOrgTz();
  const today = todayInOrgTz();

  if (date.getTime() !== today.getTime()) {
    throw new ApiError("You can only respond for today", "INVALID_DATE", 400);
  }

  const mealType = await prisma.mealType.findUnique({ where: { id: body.mealTypeId } });
  if (!mealType || !mealType.isEnabled) {
    throw new ApiError("This meal type is not currently active", "MEAL_TYPE_DISABLED", 400);
  }

  const holiday = await prisma.calendarException.findUnique({ where: { date } });
  if (holiday?.type === "HOLIDAY") {
    throw new ApiError("Today is a holiday — no meal response is required", "HOLIDAY", 400);
  }

  if (isPastCutoff(date, mealType.cutoffTime)) {
    throw new ApiError(
      `The response window closed at ${mealType.cutoffTime}. Your response is now locked for today.`,
      "CUTOFF_PASSED",
      409
    );
  }

  const existing = await prisma.mealResponse.findUnique({
    where: { employeeId_mealTypeId_date: { employeeId: user.employee.id, mealTypeId: body.mealTypeId, date } }
  });

  if (existing?.isLocked) {
    throw new ApiError("This response has already been locked and cannot be changed", "ALREADY_LOCKED", 409);
  }

  if (!mealType.allowModificationBeforeCutoff && existing) {
    throw new ApiError("Modifying your response is not allowed for this meal type", "MODIFICATION_NOT_ALLOWED", 403);
  }

  const saved = await prisma.mealResponse.upsert({
    where: { employeeId_mealTypeId_date: { employeeId: user.employee.id, mealTypeId: body.mealTypeId, date } },
    create: {
      employeeId: user.employee.id,
      mealTypeId: body.mealTypeId,
      date,
      status: body.status,
      respondedAt: new Date(),
      lastModifiedAt: new Date()
    },
    update: {
      status: body.status,
      lastModifiedAt: new Date()
    }
  });

  return ok(saved, "Response saved");
});
