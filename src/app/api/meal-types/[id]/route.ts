import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { mealTypeSettingsSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export const PATCH = withRoute(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireRole("SUPER_ADMIN");
  const body = mealTypeSettingsSchema.parse(await req.json());
  const before = await prisma.mealType.findUnique({ where: { id: params.id } });
  if (!before) throw new ApiError("Meal type not found", "NOT_FOUND", 404);

  const updated = await prisma.mealType.update({ where: { id: params.id }, data: body });
  await writeAudit({
    userId: user.id,
    action: "MEAL_TYPE_CONFIG_CHANGE",
    entity: "MealType",
    entityId: params.id,
    previousValue: before,
    newValue: updated
  });
  return ok(updated, "Meal type settings updated");
});
