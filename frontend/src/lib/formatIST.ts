import { formatInTimeZone } from "date-fns-tz";

export const IST_TZ = "Asia/Kolkata";

export function formatIST(date: string | Date, pattern = "dd MMM yyyy, HH:mm"): string {
  return formatInTimeZone(new Date(date), IST_TZ, pattern);
}
