import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { ApiError } from "../../middleware/errors";
import { env } from "../../config/env";
import { assertStrongPassword } from "../../lib/password-policy";
import { recordAudit } from "../audit/audit.service";
import { looksLikeEmail, normalizePhone, requireNormalizedPhone } from "../../lib/phone";

const ALLOWED_REGISTRATION_DOMAINS = ["soliflexpackaging.com", "indautogroup.com"];

export function assertAllowedRegistrationDomain(email: string): void {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain || !ALLOWED_REGISTRATION_DOMAINS.includes(domain)) {
    throw new ApiError(
      400,
      `Registration is only available for company email addresses (@${ALLOWED_REGISTRATION_DOMAINS.join(", @")}).`
    );
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function ttlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

/** Canonical form of a sign-in identifier (lower-case email, or E.164 phone) — also the throttle key. */
export function canonicalIdentifier(identifier: string): string {
  const value = identifier.trim();
  if (looksLikeEmail(value)) return value.toLowerCase();
  return normalizePhone(value) ?? value.toLowerCase();
}

const INVALID_CREDENTIALS = "Invalid email / mobile number or password";

/** Signs in with either an email address or a mobile number plus the password. */
export async function login(identifier: string, password: string) {
  const value = identifier.trim();
  let user = null;
  if (looksLikeEmail(value)) {
    user = await prisma.user.findUnique({ where: { email: value.toLowerCase() } });
  } else {
    const phone = normalizePhone(value);
    if (phone) user = await prisma.user.findUnique({ where: { phone } });
  }
  if (!user || !user.active) {
    throw new ApiError(401, INVALID_CREDENTIALS);
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, INVALID_CREDENTIALS);
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    workstream: user.workstream,
    name: user.name,
    mustResetPassword: user.mustResetPassword,
  });
  const refreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      token: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + ttlToMs(env.jwtRefreshTtl)),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
  };
}

export interface RegisterEmployeeInput {
  employeeId: string;
  name: string;
  /** At least one of email / phone is required; both may be given. */
  email?: string;
  phone?: string;
  password: string;
}

/**
 * Public self-registration — always creates an EMPLOYEE account. The role is
 * hardcoded here rather than accepted from the request body; that is the
 * actual security boundary preventing self-service privilege escalation.
 */
export async function registerEmployee(input: RegisterEmployeeInput) {
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;
  const phone = input.phone?.trim() ? requireNormalizedPhone(input.phone) : null;
  if (!email && !phone) {
    throw new ApiError(400, "Provide an email address, a mobile number, or both");
  }
  // Only email registration is restricted to company domains; a mobile number
  // has no domain, so the employee ID + number are what identifies the person.
  if (email) assertAllowedRegistrationDomain(email);
  assertStrongPassword(input.password, { email, name: input.name, phone });

  const existing = await prisma.user.findFirst({
    where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : []), { employeeId: input.employeeId }] },
  });
  if (existing) {
    throw new ApiError(409, "A user with this email, mobile number or employee ID already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        employeeId: input.employeeId,
        name: input.name,
        email,
        phone,
        passwordHash,
        role: Role.EMPLOYEE,
        workstream: null,
        mustResetPassword: false,
        active: true,
      },
    });
    await recordAudit(tx, {
      entityType: "User",
      entityId: created.id,
      action: "SELF_REGISTER",
      changedById: created.id,
      newValue: `${created.name} (EMPLOYEE)`,
    });
    return created;
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, workstream: user.workstream, name: user.name });
  const refreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      token: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + ttlToMs(env.jwtRefreshTtl)),
    },
  });

  return { accessToken, refreshToken, user: sanitizeUser(user) };
}

export async function refresh(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Session expired, please log in again");
  }

  const hashed = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { token: hashed } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new ApiError(401, "Session expired, please log in again");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) {
    throw new ApiError(401, "Account is no longer active");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    workstream: user.workstream,
    name: user.name,
    mustResetPassword: user.mustResetPassword,
  });

  return { accessToken, user: sanitizeUser(user) };
}

/** Ends every logged-in session of a user (password reset, deactivation, role change). */
export async function revokeAllSessions(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
}

export async function logout(refreshToken: string) {
  const hashed = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { token: hashed },
    data: { revoked: true },
  });
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new ApiError(400, "Current password is incorrect");
  }
  if (currentPassword === newPassword) {
    throw new ApiError(400, "Choose a new password that is different from your current one");
  }
  assertStrongPassword(newPassword, { email: user.email, name: user.name, phone: user.phone });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustResetPassword: false },
  });
}

/**
 * Lets a signed-in user add or change the email / mobile number they sign in
 * with, so someone who registered with one can capture the other. Requires the
 * current password; at least one identifier must always remain.
 */
export async function updateOwnContact(
  userId: string,
  input: { currentPassword: string; email?: string | null; phone?: string | null }
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(400, "Current password is incorrect");

  const email =
    input.email === undefined ? user.email : input.email === null || !input.email.trim() ? null : input.email.trim().toLowerCase();
  const phone =
    input.phone === undefined ? user.phone : input.phone === null || !input.phone.trim() ? null : requireNormalizedPhone(input.phone);
  if (!email && !phone) {
    throw new ApiError(400, "You must keep at least one of email or mobile number to sign in");
  }
  if (email && email !== user.email) {
    assertAllowedRegistrationDomain(email);
    if (await prisma.user.findFirst({ where: { email, NOT: { id: userId } } })) {
      throw new ApiError(409, "That email address is already used by another account");
    }
  }
  if (phone && phone !== user.phone) {
    if (await prisma.user.findFirst({ where: { phone, NOT: { id: userId } } })) {
      throw new ApiError(409, "That mobile number is already used by another account");
    }
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: userId }, data: { email, phone } });
    if (email !== user.email) {
      await recordAudit(tx, { entityType: "User", entityId: userId, field: "email", oldValue: user.email ?? undefined, newValue: email ?? undefined, action: "UPDATE", changedById: userId });
    }
    if (phone !== user.phone) {
      await recordAudit(tx, { entityType: "User", entityId: userId, field: "phone", oldValue: user.phone ?? undefined, newValue: phone ?? undefined, action: "UPDATE", changedById: userId });
    }
    return u;
  });
  return sanitizeUser(updated);
}

export function sanitizeUser<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
