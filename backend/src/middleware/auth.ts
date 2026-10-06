import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../lib/jwt";
import { ApiError } from "./errors";
import { prisma } from "../lib/prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    throw new ApiError(401, "Not authenticated");
  }
  try {
    req.user = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }

  // Accounts on a temporary password (new user / admin reset) may only change it.
  // The token flag is just a hint; the database decides, so the block lifts the
  // moment the password is changed without needing a new token.
  if (req.user.mustResetPassword && !req.originalUrl.startsWith("/api/auth/")) {
    const current = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { mustResetPassword: true } });
    if (current?.mustResetPassword) {
      throw new ApiError(403, "You must change your temporary password before continuing.", "PASSWORD_RESET_REQUIRED");
    }
  }
  next();
}

export function requireRole(...roles: AccessTokenPayload["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, "Not authenticated");
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "You do not have permission to perform this action");
    }
    next();
  };
}
