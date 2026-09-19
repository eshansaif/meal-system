import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { holidaySchema } from "@/lib/validation";
import { normalizeDate } from "@/lib/dates";
import { writeAudit } from "@/lib/audit";

export const GET = withRoute(async () => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE");
  const holidays = await prisma.calendarException.findMany({ orderBy: { date: "asc" } });
  return ok(holidays);
});

export const POST = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = holidaySchema.parse(await req.json());
  const created = await prisma.calendarException.create({
    data: { date: normalizeDate(body.date), type: body.type, label: body.label }
  });
  await writeAudit({ userId: user.id, action: "HOLIDAY_CREATE", entity: "CalendarException", entityId: created.id, newValue: created });
  return ok(created, "Calendar exception added", 201);
});
