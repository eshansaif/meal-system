import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { holidaySchema } from "@/lib/validation";
import { normalizeDate, settlementMonthOf } from "@/lib/dates";
import { writeAudit } from "@/lib/audit";
import { computeAndSaveSettlement } from "@/lib/settlement";

export const GET = withRoute(async () => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE");
  const holidays = await prisma.calendarException.findMany({ orderBy: { date: "asc" } });
  return ok(holidays);
});

/**
 * Marking a date as a HOLIDAY ("office is closed — meal is off for
 * everyone this day") cascades: any employee responses for that date are
 * reset to NOT_TAKING and locked, and any consumption already recorded is
 * cancelled and un-charged, since the office being closed overrides
 * whatever was previously planned. Affected employees' settlements for
 * that month are then recomputed so outstanding/paid figures stay correct.
 */
export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = holidaySchema.parse(await req.json());
  const date = normalizeDate(body.date);

  const created = await prisma.calendarException.create({
    data: { date, type: body.type, label: body.label }
  });

  let affectedEmployeeIds: string[] = [];

  if (body.type === "HOLIDAY") {
    const [responses, consumptions] = await Promise.all([
      prisma.mealResponse.findMany({ where: { date } }),
      prisma.mealConsumption.findMany({ where: { date, isChargeable: true } })
    ]);

    await prisma.mealResponse.updateMany({
      where: { date },
      data: { status: "NOT_TAKING", isLocked: true, lastModifiedAt: new Date() }
    });

    await prisma.mealConsumption.updateMany({
      where: { date },
      data: { servingStatus: "CANCELLED", isChargeable: false, chargeAmount: 0, remarks: `Office closed: ${body.label}` }
    });

    affectedEmployeeIds = Array.from(
      new Set([...responses.map((r) => r.employeeId), ...consumptions.map((c) => c.employeeId)])
    );

    if (affectedEmployeeIds.length > 0) {
      const month = settlementMonthOf(date);
      await Promise.all(affectedEmployeeIds.map((id) => computeAndSaveSettlement(id, month)));
    }
  }

  await writeAudit({
    userId: user.id,
    action: "HOLIDAY_CREATE",
    entity: "CalendarException",
    entityId: created.id,
    newValue: created,
    reason: affectedEmployeeIds.length > 0 ? `Reversed ${affectedEmployeeIds.length} employee response/charge(s) for this date` : undefined
  });

  return ok(created, "Calendar exception added", 201);
});
