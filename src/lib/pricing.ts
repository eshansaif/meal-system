import { prisma } from "./db";
import { ApiError } from "./api";
import { normalizeDate } from "./dates";
import { Prisma } from "@prisma/client";

/**
 * Returns the MealPriceHistory record applicable to a given meal type on a
 * given date (the record whose [effectiveFrom, effectiveTo) window contains
 * the date). Throws if no price is configured — a meal must never be
 * chargeable at an undefined price.
 */
export async function getApplicablePrice(mealTypeId: string, date: Date) {
  const d = normalizeDate(date);
  const price = await prisma.mealPriceHistory.findFirst({
    where: {
      mealTypeId,
      effectiveFrom: { lte: d },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: d } }]
    },
    orderBy: { effectiveFrom: "desc" }
  });
  if (!price) {
    throw new ApiError(
      "No meal price is configured for this date. Ask an administrator to set one under Settings > Meal Pricing.",
      "NO_PRICE_CONFIGURED",
      409
    );
  }
  return price;
}

/**
 * Creates a new price period for a meal type, automatically closing the
 * previously active (open-ended) period at (effectiveFrom - 1 day) so
 * periods never overlap. Historical MealConsumption rows are untouched —
 * they keep the unitPriceApplied snapshot taken at charge time.
 */
export async function setMealPrice(params: {
  mealTypeId: string;
  unitPrice: number;
  effectiveFrom: Date;
  userId: string;
}) {
  const effectiveFrom = normalizeDate(params.effectiveFrom);

  return prisma.$transaction(async (tx) => {
    const overlapping = await tx.mealPriceHistory.findFirst({
      where: {
        mealTypeId: params.mealTypeId,
        isActive: true,
        effectiveFrom: { lte: effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }]
      },
      orderBy: { effectiveFrom: "desc" }
    });

    if (overlapping) {
      if (overlapping.effectiveFrom.getTime() === effectiveFrom.getTime()) {
        throw new ApiError(
          "A price period already starts on this exact date. Edit that entry instead of creating a duplicate.",
          "PRICE_PERIOD_CONFLICT",
          409
        );
      }
      const dayBefore = new Date(effectiveFrom);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      await tx.mealPriceHistory.update({
        where: { id: overlapping.id },
        data: { effectiveTo: dayBefore }
      });
    }

    return tx.mealPriceHistory.create({
      data: {
        mealTypeId: params.mealTypeId,
        unitPrice: new Prisma.Decimal(params.unitPrice),
        effectiveFrom,
        effectiveTo: null,
        isActive: true,
        createdByUserId: params.userId
      }
    });
  });
}
