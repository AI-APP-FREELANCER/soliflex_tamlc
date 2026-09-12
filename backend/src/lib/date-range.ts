/**
 * Resolves UI date-range presets (Today / This week / Month to date / etc.)
 * into UTC Date bounds for Prisma `gte`/`lte` filters, using IST (UTC+5:30,
 * no DST) as the calendar the presets are computed against — all timestamps
 * in the app are stored in UTC but presented/filtered as IST wall-clock days.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istWallClockParts(d: Date): { y: number; m: number; day: number } {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/** Converts an IST calendar date (y/m/day, month 0-indexed) to its UTC midnight instant. */
function istMidnightUtc(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m, day, 0, 0, 0) - IST_OFFSET_MS);
}

export type RangePreset = "today" | "this_week" | "mtd" | "last_7_days" | "last_30_days" | "custom";

export interface DateRangeQuery {
  range?: string;
  from?: string;
  to?: string;
}

export interface DateRange {
  gte?: Date;
  lte?: Date;
}

/** Parses a "YYYY-MM-DD" string (from <input type="date">) as an IST calendar day. */
function parseIsoDate(value: string): { y: number; m: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, day: Number(match[3]) };
}

export function resolveDateRange(query: DateRangeQuery): DateRange | undefined {
  const preset = query.range as RangePreset | undefined;
  if (!preset) return undefined;

  const now = new Date();

  if (preset === "custom") {
    const from = query.from ? parseIsoDate(query.from) : null;
    const to = query.to ? parseIsoDate(query.to) : null;
    if (!from && !to) return undefined;
    return {
      gte: from ? istMidnightUtc(from.y, from.m, from.day) : undefined,
      lte: to ? new Date(istMidnightUtc(to.y, to.m, to.day + 1).getTime() - 1) : undefined,
    };
  }

  const { y, m, day } = istWallClockParts(now);

  switch (preset) {
    case "today":
      return { gte: istMidnightUtc(y, m, day), lte: now };
    case "last_7_days":
      return { gte: new Date(now.getTime() - 7 * 86_400_000), lte: now };
    case "last_30_days":
      return { gte: new Date(now.getTime() - 30 * 86_400_000), lte: now };
    case "mtd":
      return { gte: istMidnightUtc(y, m, 1), lte: now };
    case "this_week": {
      // ISO week starting Monday
      const dowSunday0 = new Date(Date.UTC(y, m, day)).getUTCDay(); // 0 = Sunday
      const mondayOffset = (dowSunday0 + 6) % 7;
      return { gte: istMidnightUtc(y, m, day - mondayOffset), lte: now };
    }
    default:
      return undefined;
  }
}
