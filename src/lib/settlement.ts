import { prisma } from "./db";
import { previousMonth } from "./dates";
import { Prisma, PaymentStatus } from "@prisma/client";

const D = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v);

/**
 * Computes (and upserts) the monthly settlement snapshot for one employee.
 *
 * Accounting rule (documented per spec section 13):
 *   currentOutstanding = mealCost + previousOutstanding - paymentsThisMonth
 *   if currentOutstanding < 0: outstanding = 0, credit = -currentOutstanding
 *   else: outstanding = currentOutstanding, credit = 0
 *
 * previousOutstanding is read from the PREVIOUS month's settlement record
 * (its outstanding minus its credit rolls forward as a debt/credit basis).
 * If no previous settlement exists yet, previousOutstanding = 0.
 *
 * This function is idempotent and safe to re-run any time (e.g. after a
 * payment is recorded/voided, or a serving status changes) UNLESS the
 * settlement has been finalized, in which case it must be recomputed only
 * through an explicit, audited adjustment.
 */
export async function computeAndSaveSettlement(employeeId: string, month: string) {
  const existing = await prisma.settlement.findUnique({
    where: { employeeId_settlementMonth: { employeeId, settlementMonth: month } }
  });
  if (existing?.isFinalized) {
    return existing; // Finalized months are protected; caller must use an explicit adjustment path.
  }

  const [consumptions, payments, prevSettlement] = await Promise.all([
    prisma.mealConsumption.findMany({
      where: { employeeId, settlementMonth: month, isChargeable: true }
    }),
    prisma.payment.findMany({
      where: { employeeId, settlementMonth: month, status: "ACTIVE" }
    }),
    prisma.settlement.findUnique({
      where: {
        employeeId_settlementMonth: { employeeId, settlementMonth: previousMonth(month) }
      }
    })
  ]);

  const mealsServed = consumptions.length;
  const mealCost = consumptions.reduce((sum, c) => sum.plus(c.chargeAmount), D(0));
  const paymentsThisMonth = payments.reduce((sum, p) => sum.plus(p.amount), D(0));

  // Previous month's net position rolls forward: an unpaid balance becomes
  // this month's previousOutstanding; a credit reduces it (represented as
  // a negative previousOutstanding contribution).
  const previousOutstanding = prevSettlement
    ? D(prevSettlement.outstanding).minus(D(prevSettlement.credit))
    : D(0);

  const totalPaid = paymentsThisMonth; // paid *this month*; lifetime total is a separate reporting query
  const net = mealCost.plus(previousOutstanding).minus(paymentsThisMonth);

  let outstanding = D(0);
  let credit = D(0);
  if (net.isNegative()) {
    credit = net.negated();
  } else {
    outstanding = net;
  }

  let paymentStatus: PaymentStatus;
  if (credit.greaterThan(0)) paymentStatus = "OVERPAID";
  else if (outstanding.equals(0)) paymentStatus = "PAID"; // nothing owed, whether because it was paid off or there was nothing to pay
  else if (paymentsThisMonth.greaterThan(0)) paymentStatus = "PARTIALLY_PAID";
  else paymentStatus = "UNPAID";

  const saved = await prisma.settlement.upsert({
    where: { employeeId_settlementMonth: { employeeId, settlementMonth: month } },
    create: {
      employeeId,
      settlementMonth: month,
      mealsServed,
      mealCost,
      previousOutstanding: previousOutstanding.isNegative() ? D(0) : previousOutstanding,
      paymentsThisMonth,
      totalPaid,
      outstanding,
      credit,
      paymentStatus,
      computedAt: new Date()
    },
    update: {
      mealsServed,
      mealCost,
      previousOutstanding: previousOutstanding.isNegative() ? D(0) : previousOutstanding,
      paymentsThisMonth,
      totalPaid,
      outstanding,
      credit,
      paymentStatus,
      computedAt: new Date()
    }
  });

  return saved;
}

/** Recomputes settlements for every active employee for a given month. Used by the monthly report/dashboard. */
export async function recomputeSettlementsForMonth(month: string) {
  const employees = await prisma.employee.findMany({ select: { id: true } });
  const results = [];
  for (const e of employees) {
    results.push(await computeAndSaveSettlement(e.id, month));
  }
  return results;
}

/** Lifetime total paid + lifetime outstanding across all months (for the employee financial page). */
export async function getLifetimeFinancials(employeeId: string) {
  const [paidAgg, settlements] = await Promise.all([
    prisma.payment.aggregate({
      where: { employeeId, status: "ACTIVE" },
      _sum: { amount: true }
    }),
    prisma.settlement.findMany({ where: { employeeId }, orderBy: { settlementMonth: "desc" } })
  ]);
  const currentOutstanding = settlements[0] ? D(settlements[0].outstanding).minus(D(settlements[0].credit)) : D(0);
  return {
    totalPaid: paidAgg._sum.amount ? D(paidAgg._sum.amount).toFixed(2) : "0.00",
    currentOutstanding: currentOutstanding.isNegative() ? "0.00" : currentOutstanding.toFixed(2),
    currentCredit: currentOutstanding.isNegative() ? currentOutstanding.negated().toFixed(2) : "0.00"
  };
}
