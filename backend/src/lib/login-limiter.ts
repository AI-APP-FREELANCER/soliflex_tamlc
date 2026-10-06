/**
 * Brute-force protection for login: after MAX_FAILURES wrong passwords for the
 * same email from the same address within WINDOW_MS, further attempts are
 * refused (429) until the window passes. In-memory, which is fine for the
 * single API process; a restart simply resets the counters.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length > 0) failures.set(key, list);
  else failures.delete(key);
  return list;
}

/** Returns the number of seconds the caller must wait, or 0 if the attempt is allowed. */
export function loginRetryAfterSeconds(key: string, now = Date.now()): number {
  const list = recent(key, now);
  if (list.length < MAX_FAILURES) return 0;
  return Math.ceil((WINDOW_MS - (now - list[0])) / 1000);
}

export function recordLoginFailure(key: string, now = Date.now()) {
  failures.set(key, [...recent(key, now), now]);
}

export function clearLoginFailures(key: string) {
  failures.delete(key);
}
