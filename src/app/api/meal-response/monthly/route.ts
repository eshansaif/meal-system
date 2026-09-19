import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { todayInOrgTz, isPastCutoff, normalizeDate } from "@/lib/dates";
import { isWorkingDay } from "@/lib/orgSettings";

const bodySchema = z.object({
  mealTypeId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM format").optional()
});

/**
 * POST /api/meal-response/monthly — "I'm fairly sure I'll be taking lunch
 * all month." Bulk-sets TAKING for every remaining working day in the given
 * month (defaults to the current month), starting from today. Days that are
 * holidays, non-working days, or already past their cutoff (i.e. today,
 * once the cutoff time has passed) are simply skipped rather than erroring —
 * this is a best-effort convenience action, not an all-or-nothing one.
 *
 * The employee can still cancel any individual future day afterward via
 * POST /api/meal-response — an explicit cancel always wins over this bulk
 * default (see isMonthlyDefault handling there).
 */
export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("EMPLOYEE");
  if (!user.employee) throw new ApiError("Only employee accounts can plan meals", "NOT_AN_EMPLOYEE", 400);

  const body = bodySchema.parse(await req.json());
  const today = todayInOrgTz();
  const month = body.month || `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  const mealType = await prisma.mealType.findUnique({ where: { id: body.mealTypeId } });
  if (!mealType || !mealType.isEnabled) {
    throw new ApiError("This meal type is not currently active", "MEAL_TYPE_DISABLED", 400);
  }

  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0)); // last day of month
  const rangeStart = monthStart.getTime() > today.getTime() ? monthStart : today;

  if (rangeStart.getTime() > monthEnd.getTime()) {
    throw new ApiError("That month has already ended", "MONTH_ALREADY_PASSED", 400);
  }

  let planned = 0;
  let skipped = 0;
  const existingLocked: string[] = [];

  for (let d = new Date(rangeStart); d.getTime() <= monthEnd.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = normalizeDate(new Date(d));

    const working = await isWorkingDay(date);
    if (!working) {
      skipped++;
      continue;
    }
    if (isPastCutoff(date, mealType.cutoffTime)) {
      // Only "today, after cutoff" can hit this inside the loop range — skip quietly.
      skipped++;
      continue;
    }

    const existing = await prisma.mealResponse.findUnique({
      where: { employeeId_mealTypeId_date: { employeeId: user.employee.id, mealTypeId: body.mealTypeId, date } }
    });

    if (existing?.isLocked) {
      existingLocked.push(date.toISOString().slice(0, 10));
      skipped++;
      continue;
    }

    // Don't stomp a day the employee has already explicitly decided NOT_TAKING for —
    // "plan the month" should fill gaps, not override a deliberate cancellation.
    if (existing && existing.status === "NOT_TAKING" && !existing.isMonthlyDefault) {
      skipped++;
      continue;
    }

    await prisma.mealResponse.upsert({
      where: { employeeId_mealTypeId_date: { employeeId: user.employee.id, mealTypeId: body.mealTypeId, date } },
      create: {
        employeeId: user.employee.id,
        mealTypeId: body.mealTypeId,
        date,
        status: "TAKING",
        respondedAt: new Date(),
        lastModifiedAt: new Date(),
        isMonthlyDefault: true
      },
      update: {
        status: "TAKING",
        lastModifiedAt: new Date(),
        isMonthlyDefault: true
      }
    });
    planned++;
  }

  return ok({ month, planned, skipped }, `Planned ${planned} day(s) as "Taking Lunch" for ${month}`);
});
