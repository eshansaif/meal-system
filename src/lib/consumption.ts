import { prisma } from "./db";
import { getApplicablePrice } from "./pricing";
import { normalizeDate, settlementMonthOf } from "./dates";
import { ApiError } from "./api";
import { Prisma, ServingStatus } from "@prisma/client";

const CHARGEABLE_STATUSES: ServingStatus[] = ["SERVED", "EXTRA"];

/**
 * Sets the serving status for one employee/mealType/date and (re)computes
 * the chargeable amount server-side. This is the ONLY place chargeAmount is
 * ever written — the frontend never supplies it.
 *
 * Business rule (configurable per meal type via chargeOnServedOnly, default
 * true): only SERVED and EXTRA consume a charge. NOT_SERVED/CANCELLED/PENDING
 * are never charged even if the employee responded TAKING.
 */
export async function setServingStatus(params: {
  employeeId: string;
  mealTypeId: string;
  date: Date;
  servingStatus: ServingStatus;
  remarks?: string;
}) {
  const date = normalizeDate(params.date);
  const mealType = await prisma.mealType.findUniqueOrThrow({ where: { id: params.mealTypeId } });

  let unitPriceApplied: Prisma.Decimal | null = null;
  let priceHistoryId: string | null = null;
  let isChargeable = false;
  let chargeAmount = new Prisma.Decimal(0);

  const shouldCharge = mealType.chargeOnServedOnly
    ? CHARGEABLE_STATUSES.includes(params.servingStatus)
    : params.servingStatus !== "CANCELLED" && params.servingStatus !== "PENDING";

  if (shouldCharge) {
    const price = await getApplicablePrice(params.mealTypeId, date);
    unitPriceApplied = price.unitPrice;
    priceHistoryId = price.id;
    isChargeable = true;
    chargeAmount = price.unitPrice;
  }

  const consumption = await prisma.mealConsumption.upsert({
    where: {
      employeeId_mealTypeId_date: {
        employeeId: params.employeeId,
        mealTypeId: params.mealTypeId,
        date
      }
    },
    create: {
      employeeId: params.employeeId,
      mealTypeId: params.mealTypeId,
      date,
      servingStatus: params.servingStatus,
      servedAt: params.servingStatus === "SERVED" || params.servingStatus === "EXTRA" ? new Date() : null,
      unitPriceApplied,
      priceHistoryId,
      isChargeable,
      chargeAmount,
      settlementMonth: settlementMonthOf(date),
      remarks: params.remarks
    },
    update: {
      servingStatus: params.servingStatus,
      servedAt: params.servingStatus === "SERVED" || params.servingStatus === "EXTRA" ? new Date() : null,
      unitPriceApplied,
      priceHistoryId,
      isChargeable,
      chargeAmount,
      remarks: params.remarks
    }
  });

  return consumption;
}

export async function bulkSetServingStatus(
  rows: { employeeId: string; mealTypeId: string; date: Date }[],
  servingStatus: ServingStatus
) {
  const results = [];
  for (const row of rows) {
    // Sequential to keep price-lookup + write consistent per row; dataset
    // sizes here (a day's meal roster) make this fast enough without
    // needing a bulk SQL statement.
    results.push(await setServingStatus({ ...row, servingStatus }));
  }
  return results;
}
