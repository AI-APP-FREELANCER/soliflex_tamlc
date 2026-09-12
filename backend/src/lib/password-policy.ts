import { ApiError } from "../middleware/errors";

/**
 * Curated common/weak passwords — no external breach-check API is used.
 * Not exhaustive, just enough to block the most obviously weak choices.
 */
const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "password123",
    "password@123",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "qwertyuiop",
    "letmein1",
    "letmein123",
    "welcome1",
    "welcome123",
    "admin123",
    "admin@123",
    "iloveyou1",
    "soliflex123",
    "soliflex@123",
    "soliflex1234",
    "changeme1",
    "changeme123",
    "temppass1",
    "temppass123",
    "p@ssw0rd",
    "p@ssword1",
    "abc123456",
    "1q2w3e4r5t",
    "trustno1",
    "monkey123",
    "dragon123",
    "football1",
    "baseball1",
    "sunshine1",
    "master123",
    "shadow123",
    "superman1",
    "batman123",
    "starwars1",
    "whatever1",
    "freedom123",
    "flower123",
    "hunter123",
    "ranger123",
    "buster123",
    "george123",
    "harley123",
    "hannah123",
    "jennifer1",
    "jordan123",
    "michael123",
    "michelle1",
    "thomas123",
    "tigger123",
    "zaq1zaq1",
    "1qaz2wsx",
    "qazwsx123",
    "welcome@123",
    "india@123",
    "mumbai123",
    "chennai123",
    "bangalore1",
    "employee1",
    "employee123",
    "company123",
    "office@123",
    "helpdesk1",
    "helpdesk123",
    "support123",
    "letme1n123",
    "passw0rd1",
    "passw0rd@1",
  ].map((p) => p.toLowerCase())
);

export interface PasswordContext {
  email?: string;
  name?: string;
}

/**
 * Enforces password best practices shared by registration, self-service
 * change-password, and admin-generated temp passwords. Throws ApiError(400)
 * with a human-readable message listing every unmet rule.
 */
export function assertStrongPassword(password: string, ctx: PasswordContext = {}): void {
  const errors: string[] = [];

  if (password.length < 10) errors.push("be at least 10 characters long");
  if (!/[a-z]/.test(password)) errors.push("include a lowercase letter");
  if (!/[A-Z]/.test(password)) errors.push("include an uppercase letter");
  if (!/[0-9]/.test(password)) errors.push("include a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("include a symbol");
  if (/^(.)\1+$/.test(password)) errors.push("not be a single repeated character");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) errors.push("not be a commonly used password");

  const localPart = ctx.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    errors.push("not contain your email address");
  }
  const firstName = ctx.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstName && firstName.length >= 3 && password.toLowerCase().includes(firstName)) {
    errors.push("not contain your name");
  }

  if (errors.length > 0) {
    throw new ApiError(400, `Password must ${errors.join(", ")}.`);
  }
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(set: string): string {
  return set[Math.floor(Math.random() * set.length)];
}

/**
 * Generates a random password that always passes assertStrongPassword, so
 * admin-created accounts and admin-triggered resets start policy-compliant.
 */
export function generateCompliantTempPassword(): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: 8 }, () => pick(ALL));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}
