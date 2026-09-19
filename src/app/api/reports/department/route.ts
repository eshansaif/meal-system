import { ok, withRoute, requireRole } from "@/lib/api";
import { getDepartmentReport } from "@/lib/reports";
import { currentSettlementMonth } from "@/lib/dates";

export const GET = withRoute(async (req: Request) => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || currentSettlementMonth();
  const report = await getDepartmentReport(month);
  return ok(report);
});
