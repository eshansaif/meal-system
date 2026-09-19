import { prisma } from "@/lib/db";
import { ok, withRoute, requireRole, ApiError } from "@/lib/api";
import { paymentVoidSchema } from "@/lib/validation";
import { computeAndSaveSettlement } from "@/lib/settlement";
import { writeAudit } from "@/lib/audit";

/**
 * Voids (reverses) a payment. We never silently delete or edit the amount of
 * a historical financial transaction — voiding preserves the original row
 * and excludes it from settlement totals via status = VOIDED.
 */
export const POST = withRoute(async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireRole("SUPER_ADMIN", "HR_ADMIN");
  const body = paymentVoidSchema.parse(await req.json());

  const before = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!before) throw new ApiError("Payment not found", "NOT_FOUND", 404);
  if (before.status === "VOIDED") throw new ApiError("This payment is already voided", "ALREADY_VOIDED", 409);

  const updated = await prisma.payment.update({
    where: { id: params.id },
    data: {
      status: "VOIDED",
      voidReason: body.reason,
      voidedAt: new Date(),
      voidedByUserId: user.id
    }
  });

  await writeAudit({
    userId: user.id,
    action: "PAYMENT_VOID",
    entity: "Payment",
    entityId: params.id,
    previousValue: before,
    newValue: updated,
    reason: body.reason
  });

  await computeAndSaveSettlement(before.employeeId, before.settlementMonth);

  return ok(updated, "Payment voided");
});
