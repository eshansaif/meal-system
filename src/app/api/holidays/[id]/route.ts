import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

/** Removes a calendar exception (un-blocks the date). Does not retroactively restore any responses/charges that were cancelled when it was created — HR should re-enter those manually if needed. */
export const DELETE = withRoute(async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const before = await prisma.calendarException.findUnique({ where: { id: params.id } });
  if (!before) throw new ApiError("Calendar exception not found", "NOT_FOUND", 404);
  await prisma.calendarException.delete({ where: { id: params.id } });
  await writeAudit({ userId: user.id, action: "HOLIDAY_DELETE", entity: "CalendarException", entityId: params.id, previousValue: before });
  return ok(null, "Calendar exception removed");
});
