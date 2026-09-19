import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole } from "@/lib/api";
import { mealPriceSchema } from "@/lib/validation";
import { setMealPrice } from "@/lib/pricing";
import { writeAudit } from "@/lib/audit";

export const GET = withRoute(async (_req: Request, { params }: { params: { id: string } }) => {
  await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const history = await prisma.mealPriceHistory.findMany({
    where: { mealTypeId: params.id },
    orderBy: { effectiveFrom: "desc" }
  });
  return ok(history);
});

export const POST = withRoute(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireRole("SUPER_ADMIN");
  const raw = await req.json();
  const body = mealPriceSchema.parse({ ...raw, mealTypeId: params.id });

  const created = await setMealPrice({
    mealTypeId: params.id,
    unitPrice: body.unitPrice,
    effectiveFrom: body.effectiveFrom,
    userId: user.id
  });

  await writeAudit({
    userId: user.id,
    action: "PRICE_CHANGE",
    entity: "MealPriceHistory",
    entityId: created.id,
    newValue: created
  });

  return ok(created, "Price period created", 201);
});
