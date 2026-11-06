/** Formats a decimal hour count (e.g. 26.75) as "HH:MM:SS" (e.g. "26:45:00"). */
export function formatHoursAsClock(hours: number): string {
  const totalSeconds = Math.round(Math.max(0, hours) * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
