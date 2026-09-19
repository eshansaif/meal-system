import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { mealResponseSchema } from "@/lib/validation";
import { todayInOrgTz, isPastCutoff, normalizeDate } from "@/lib/dates";
import { isWorkingDay } from "@/lib/orgSettings";

const MAX_DAYS_AHEAD = 62; // roughly two months — plenty for "plan the whole month ahead"

/**
 * POST /api/meal-response — employee submits/modifies their meal response
 * for TODAY or any FUTURE date (e.g. cancelling a single day inside a
 * month they already planned via the bulk "select whole month" action).
 *
 * Cutoff is enforced here, server-side, per the target date — not just for
 * today — regardless of what the frontend countdown shows:
 *   - a date before today is always rejected (nothing to change any more)
 *   - today is locked once its cutoff time has passed
 *   - any future date remains open until IT becomes today and passes cutoff
 *
 * Uses upsert on the (employee, mealType, date) unique key so duplicate /
 * retried requests are idempotent and never create duplicate rows.
 */
export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("EMPLOYEE");
  if (!user.employee) throw new ApiError("Only employee accounts can submit a meal response", "NOT_AN_EMPLOYEE", 400);

  const body = mealResponseSchema.parse(await req.json());
  const date = body.date ? normalizeDate(body.date) : todayInOrgTz();
  const today = todayInOrgTz();

  if (date.getTime() < today.getTime()) {
    throw new ApiError("You cannot change a response for a past date", "PAST_DATE", 400);
  }

  const maxDate = new Date(today);
  maxDate.setUTCDate(maxDate.getUTCDate() + MAX_DAYS_AHEAD);
  if (date.getTime() > maxDate.getTime()) {
    throw new ApiError(`You can only plan up to ${MAX_DAYS_AHEAD} days ahead`, "TOO_FAR_AHEAD", 400);
  }

  const mealType = await prisma.mealType.findUnique({ where: { id: body.mealTypeId } });
  if (!mealType || !mealType.isEnabled) {
    throw new ApiError("This meal type is not currently active", "MEAL_TYPE_DISABLED", 400);
  }

  const workingDay = await isWorkingDay(date);
  if (!workingDay) {
    throw new ApiError("This date is a holiday or non-working day — no meal response is needed", "NON_WORKING_DAY", 400);
  }

  if (isPastCutoff(date, mealType.cutoffTime)) {
    throw new ApiError(
      `The response window for this date closed at ${mealType.cutoffTime}. It is now locked.`,
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
      lastModifiedAt: new Date(),
      isMonthlyDefault: false
    },
    update: {
      status: body.status,
      lastModifiedAt: new Date(),
      // An individual, explicit change always overrides whatever the
      // monthly bulk plan had set — it's no longer "just the default".
      isMonthlyDefault: false
    }
  });

  return ok(saved, "Response saved");
});
