import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../config/env";
import type { Role, Workstream } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  workstream: Workstream | null;
  name: string;
  /** Set while the account still uses a temporary password; see requireAuth. */
  mustResetPassword?: boolean;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessTtl as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  // jwtid makes every token unique: two sign-ins in the same second used to produce identical
  // tokens, and the second one failed on the refresh-token uniqueness constraint.
  return jwt.sign({ sub: userId }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshTtl as jwt.SignOptions["expiresIn"], jwtid: randomUUID() });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}
