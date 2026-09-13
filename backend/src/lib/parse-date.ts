import { ApiError } from "../middleware/errors";

/**
 * Parses a date string from a form field or CSV cell. Accepts ISO
 * (YYYY-MM-DD, what <input type="date"> sends) and DD-MM-YYYY / DD/MM/YYYY
 * (the format this team's spreadsheets actually use) — plain `new Date(str)`
 * silently returns an "Invalid Date" for the latter, which then blows up
 * downstream as an opaque Prisma error instead of a clear validation message.
 */
export function parseFlexibleDate(value: string | undefined | null): Date | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const isoMatch = /^\d{4}-\d{2}-\d{2}/.test(trimmed);
  if (isoMatch) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(d.getTime()) && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return d;
    }
  }

  throw new ApiError(400, `Invalid date "${value}" — use YYYY-MM-DD or DD-MM-YYYY`);
}
