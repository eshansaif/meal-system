import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { getDailyReport } from "@/lib/reports";
import { normalizeDate, todayInOrgTz } from "@/lib/dates";

export const GET = withRoute(async (req: Request) => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ? normalizeDate(searchParams.get("date")!) : todayInOrgTz();
  const mealTypeId = searchParams.get("mealTypeId") || (await prisma.mealType.findFirstOrThrow({ where: { code: "LUNCH" } })).id;
  const report = await getDailyReport(mealTypeId, date);
  return ok(report);
});
