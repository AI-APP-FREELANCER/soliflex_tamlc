import { Router } from "express";
import { z } from "zod";
import * as authService from "./auth.service";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { sanitizeUser } from "./auth.service";
import { ApiError } from "../../middleware/errors";
import { clearLoginFailures, loginRetryAfterSeconds, recordLoginFailure } from "../../lib/login-limiter";

const router = Router();

const REFRESH_COOKIE = "soliflex_refresh";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Native clients (the mobile app) have no cookie jar for the httpOnly
// refresh cookie, so they identify themselves with this header and get the
// refresh token in the JSON body instead — gated, not unconditional, so the
// token stays invisible to web-page JS (and any XSS on it) exactly as today.
function isMobileClient(req: import("express").Request): boolean {
  return req.get("X-Client-Type") === "mobile";
}

// `identifier` is an email address or a mobile number. `email` is still
// accepted so apps installed before mobile sign-in existed keep working.
const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(1),
  })
  .refine((v) => !!(v.identifier ?? v.email), { message: "Enter your email address or mobile number" });

router.post("/login", async (req, res) => {
  const parsed = loginSchema.parse(req.body);
  const identifier = (parsed.identifier ?? parsed.email)!;
  const password = parsed.password;
  const limiterKey = `${req.ip}|${authService.canonicalIdentifier(identifier)}`;
  const retryAfter = loginRetryAfterSeconds(limiterKey);
  if (retryAfter > 0) {
    res.setHeader("Retry-After", String(retryAfter));
    throw new ApiError(429, `Too many failed sign-in attempts. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`);
  }
  let result;
  try {
    result = await authService.login(identifier, password);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) recordLoginFailure(limiterKey);
    throw err;
  }
  clearLoginFailures(limiterKey);
  const { accessToken, refreshToken, user } = result;
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.json({ accessToken, user, ...(isMobileClient(req) ? { refreshToken } : {}) });
});

const registerSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  // Register with an email, a mobile number, or both (at least one).
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().optional(),
  password: z.string().min(1),
});

router.post("/register", async (req, res) => {
  const data = registerSchema.parse(req.body);
  const { accessToken, refreshToken, user } = await authService.registerEmployee(data);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.status(201).json({ accessToken, user, ...(isMobileClient(req) ? { refreshToken } : {}) });
});

const refreshBodySchema = z.object({ refreshToken: z.string().optional() }).optional();

router.post("/refresh", async (req, res) => {
  const body = refreshBodySchema.parse(req.body);
  const token = req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const { accessToken, user } = await authService.refresh(token);
  res.json({ accessToken, user });
});

router.post("/logout", async (req, res) => {
  const body = refreshBodySchema.parse(req.body);
  const token = req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
  if (token) {
    await authService.logout(token);
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
  res.json(sanitizeUser(user));
});

const updateContactSchema = z.object({
  currentPassword: z.string().min(1),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
});

router.patch("/me/contact", requireAuth, async (req, res) => {
  const data = updateContactSchema.parse(req.body);
  res.json(await authService.updateOwnContact(req.user!.sub, data));
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  // real strength rules are enforced by assertStrongPassword() in the service layer
  newPassword: z.string().min(1),
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changeOwnPassword(req.user!.sub, currentPassword, newPassword);
  res.json({ ok: true });
});

export default router;
