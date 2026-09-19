import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

export const ORG_TZ = process.env.ORG_TIMEZONE || "Asia/Dhaka";

/** "Today" as a date-only UTC-midnight Date, anchored to the org's timezone. */
export function todayInOrgTz(): Date {
  const nowInOrgTz = formatInTimeZone(new Date(), ORG_TZ, "yyyy-MM-dd");
  return new Date(`${nowInOrgTz}T00:00:00.000Z`);
}

/** Normalize any date/string to a date-only UTC-midnight Date (strips time). */
export function normalizeDate(input: Date | string): Date {
  const d = typeof input === "string" ? input : formatInTimeZone(input, ORG_TZ, "yyyy-MM-dd");
  const dateStr = typeof input === "string" ? input.slice(0, 10) : d;
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function toDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function currentSettlementMonth(): string {
  return formatInTimeZone(new Date(), ORG_TZ, "yyyy-MM");
}

export function settlementMonthOf(date: Date): string {
  return formatInTimeZone(date, ORG_TZ, "yyyy-MM");
}

/** Returns the previous "YYYY-MM" string. */
export function previousMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m is 1-indexed; -2 => previous month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Determines whether "now" (in org timezone) is past the given cutoff time
 * ("HH:mm") for the given date-only (org-tz) Date. Only meaningful for
 * today's date — any past date is always locked, any future date never is.
 */
export function isPastCutoff(date: Date, cutoffTime: string): boolean {
  const today = todayInOrgTz();
  if (date.getTime() < today.getTime()) return true;
  if (date.getTime() > today.getTime()) return false;

  const nowInOrgTz = toZonedTime(new Date(), ORG_TZ);
  const [cutH, cutM] = cutoffTime.split(":").map(Number);
  const nowMinutes = nowInOrgTz.getHours() * 60 + nowInOrgTz.getMinutes();
  const cutoffMinutes = cutH * 60 + cutM;
  return nowMinutes >= cutoffMinutes;
}

export function formatCurrency(
  amount: number | string | { toString(): string },
  symbol = process.env.CURRENCY_SYMBOL || "৳"
): string {
  const n = typeof amount === "number" ? amount : parseFloat(amount.toString());

  return `${symbol}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function humanDate(d: Date): string {
  return format(d, "dd MMM yyyy");
}
