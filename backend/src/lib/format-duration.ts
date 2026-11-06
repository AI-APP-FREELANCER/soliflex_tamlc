/** Formats a decimal hour count (e.g. 26.75) as "HH:MM:SS" (e.g. "26:45:00"). */
export function formatHoursAsClock(hours: number): string {
  const totalSeconds = Math.round(Math.max(0, hours) * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Formats the gap between two timestamps as "HH:MM:SS", or "" if either end is missing. */
export function formatMsAsClock(ms: number): string {
  return formatHoursAsClock(ms / 3_600_000);
}
