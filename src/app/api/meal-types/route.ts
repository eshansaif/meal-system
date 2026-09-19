import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { getApplicablePrice } from "@/lib/pricing";
import { todayInOrgTz } from "@/lib/dates";

export const GET = withRoute(async (req: Request) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE", "CATERING");
  const { searchParams } = new URL(req.url);
  const onlyEnabled = searchParams.get("onlyEnabled") === "true" || user.role === "EMPLOYEE";

  const mealTypes = await prisma.mealType.findMany({
    where: onlyEnabled ? { isEnabled: true } : undefined,
    orderBy: { name: "asc" }
  });

  const withPrice = await Promise.all(
    mealTypes.map(async (mt) => {
      let currentPrice = null;
      try {
        currentPrice = await getApplicablePrice(mt.id, todayInOrgTz());
      } catch {
        // No price configured yet — leave null, UI will prompt admin.
      }
      return { ...mt, currentUnitPrice: currentPrice?.unitPrice ?? null };
    })
  );

  return ok(withPrice);
});
