import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { ApiError } from "../../middleware/errors";
import { env } from "../../config/env";
import { assertStrongPassword } from "../../lib/password-policy";
import { recordAudit } from "../audit/audit.service";

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

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) {
    throw new ApiError(401, "Invalid email or password");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    workstream: user.workstream,
    name: user.name,
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
  email: string;
  password: string;
  phone?: string;
}

/**
 * Public self-registration — always creates an EMPLOYEE account. The role is
 * hardcoded here rather than accepted from the request body; that is the
 * actual security boundary preventing self-service privilege escalation.
 */
export async function registerEmployee(input: RegisterEmployeeInput) {
  const email = input.email.toLowerCase();
  assertAllowedRegistrationDomain(email);
  assertStrongPassword(input.password, { email, name: input.name });

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { employeeId: input.employeeId }] },
  });
  if (existing) {
    throw new ApiError(409, "A user with this email or employee ID already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        employeeId: input.employeeId,
        name: input.name,
        email,
        phone: input.phone,
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
  });

  return { accessToken, user: sanitizeUser(user) };
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
  assertStrongPassword(newPassword, { email: user.email, name: user.name });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustResetPassword: false },
  });
}

export function sanitizeUser<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
