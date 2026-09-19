import { prisma } from "./db";

const WORKING_DAYS_KEY = "WORKING_DAYS";

/** Default working week: Sunday–Thursday (0=Sun..6=Sat), the common Bangladesh office week. */
const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4];

export async function getWorkingDays(): Promise<number[]> {
  const row = await prisma.orgSetting.findUnique({ where: { key: WORKING_DAYS_KEY } });
  if (!row) return DEFAULT_WORKING_DAYS;
  const value = row.value as unknown;
  return Array.isArray(value) && value.every((v) => typeof v === "number") ? (value as number[]) : DEFAULT_WORKING_DAYS;
}

export async function setWorkingDays(days: number[]): Promise<number[]> {
  const cleaned = Array.from(new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
  await prisma.orgSetting.upsert({
    where: { key: WORKING_DAYS_KEY },
    create: { key: WORKING_DAYS_KEY, value: cleaned },
    update: { value: cleaned }
  });
  return cleaned;
}

/**
 * Whether the given date counts as a working day, accounting for the
 * configured weekly pattern AND any CalendarException override:
 *  - a HOLIDAY exception always makes the date a non-working day, even if
 *    its weekday is normally a working day
 *  - a SPECIAL_WORKING_DAY exception always makes the date a working day,
 *    even if its weekday is normally off (e.g. an off-day the office opens
 *    for specially)
 */
export async function isWorkingDay(date: Date): Promise<boolean> {
  const exception = await prisma.calendarException.findUnique({ where: { date } });
  if (exception?.type === "HOLIDAY") return false;
  if (exception?.type === "SPECIAL_WORKING_DAY") return true;
  const workingDays = await getWorkingDays();
  return workingDays.includes(date.getUTCDay());
}
