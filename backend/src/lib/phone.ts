import { ApiError } from "../middleware/errors";

/**
 * Normalises a mobile number to E.164 so the same phone always compares equal
 * no matter how it was typed ("98765 43210", "+91-98765-43210", "09876543210").
 *
 * Indian numbers (the common case here) may be given as 10 digits, with a
 * leading 0, or with 91 / +91. Other international numbers must start with "+".
 * Returns null when the input cannot be read as a phone number.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[^0-9]/g, "");
  if (hasPlus) {
    return /^[0-9]{8,15}$/.test(digits) ? `+${digits}` : null;
  }
  if (/^[6-9][0-9]{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9][0-9]{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91[6-9][0-9]{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export function requireNormalizedPhone(input: string): string {
  const phone = normalizePhone(input);
  if (!phone) {
    throw new ApiError(400, "Enter a valid mobile number (10 digits, or with country code e.g. +91 98765 43210)");
  }
  return phone;
}

/** True when the sign-in identifier looks like an email rather than a phone number. */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@");
}
