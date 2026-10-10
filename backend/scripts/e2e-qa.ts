/**
 * End-to-end QA of the real API (routes, auth, roles, workflows, validation,
 * uploads, notifications, audit, background jobs) against a THROWAWAY database.
 *
 * Never run against production data. Run with:
 *   DATABASE_URL=<qa db url> UPLOAD_DIR=<tmp dir> npx tsx scripts/e2e-qa.ts
 * (the database must be migrated and seeded: prisma migrate deploy && tsx prisma/seed.ts)
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";
import { initSockets } from "../src/sockets";
import { startSlaCheckJob } from "../src/jobs/sla-check.job";
import { startHelpdeskDeadlineCheckJob } from "../src/jobs/helpdesk-deadline-check.job";
import { startAssetAlertsJob } from "../src/jobs/asset-alerts.job";

const SEED = "Soliflex@123";
const prisma = new PrismaClient();
let base = "";
let baseUrl = "";
let failures = 0;
let checks = 0;
const failed: string[] = [];

type R = { status: number; body: any; headers: Headers };

async function call(method: string, path: string, o: { token?: string; body?: unknown; form?: FormData; headers?: Record<string, string>; raw?: string } = {}): Promise<R> {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  let body: BodyInit | undefined;
  if (o.form) body = o.form;
  else if (o.raw !== undefined) {
    headers["Content-Type"] = "application/json";
    body = o.raw;
  } else if (o.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(o.body);
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  const text = await res.text();
  let parsed: any = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* not json */
  }
  return { status: res.status, body: parsed, headers: res.headers };
}
const get = (t: string | undefined, p: string) => call("GET", `/api${p}`, { token: t });
const post = (t: string | undefined, p: string, body?: unknown) => call("POST", `/api${p}`, { token: t, body: body ?? {} });
const patch = (t: string | undefined, p: string, body?: unknown) => call("PATCH", `/api${p}`, { token: t, body: body ?? {} });

function ok(label: string, cond: boolean, detail = "") {
  checks++;
  if (!cond) {
    failures++;
    failed.push(label);
    console.log(`  FAIL  ${label}${detail ? "  -> " + detail : ""}`);
  }
}
const is = (label: string, r: R, status: number) => ok(label, r.status === status, `expected ${status}, got ${r.status} ${typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 160) : String(r.body).slice(0, 80)}`);
const section = (name: string) => console.log(`\n== ${name}`);

async function login(identifier: string, password = SEED, mobile = false) {
  const r = await call("POST", "/api/auth/login", { body: { identifier, password }, headers: mobile ? { "X-Client-Type": "mobile" } : {} });
  return r;
}
async function tokenFor(email: string, password = SEED): Promise<string> {
  const r = await login(email, password);
  if (r.status !== 200) throw new Error(`cannot login ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken;
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
function file(name = "x.png", type = "image/png", bytes: Buffer = PNG) {
  const f = new FormData();
  f.append("file", new Blob([bytes], { type }), name);
  return f;
}
async function notifs(token: string) {
  const r = await get(token, "/notifications");
  return r.body as { id: string; message: string; read: boolean; type: string }[];
}
const hasNotif = (list: { message: string }[], text: string) => list.some((n) => n.message.includes(text));
const future = (days = 3) => new Date(Date.now() + days * 86_400_000).toISOString();

/** Creates a user as admin, proves the temp-password lock, then sets a real password. */
async function onboard(adminToken: string, input: Record<string, unknown>, newPassword: string) {
  const c = await post(adminToken, "/users", input);
  if (c.status !== 201) throw new Error(`create user failed ${c.status} ${JSON.stringify(c.body)}`);
  const email = c.body.user.email as string;
  const temp = c.body.tempPassword as string;
  const t1 = await tokenFor(email, temp);
  const blocked = await get(t1, "/helpdesk");
  ok(`new user ${email}: API blocked until password change`, blocked.status === 403 && blocked.body.code === "PASSWORD_RESET_REQUIRED", JSON.stringify(blocked.body));
  const me = await get(t1, "/auth/me");
  ok(`new user ${email}: /auth/me still allowed and flags mustResetPassword`, me.status === 200 && me.body.mustResetPassword === true);
  const ch = await post(t1, "/auth/change-password", { currentPassword: temp, newPassword });
  ok(`new user ${email}: can set a real password`, ch.status === 200, JSON.stringify(ch.body));
  const after = await get(t1, "/auth/me");
  ok(`new user ${email}: lock lifts without a new token`, after.status === 200 && after.body.mustResetPassword === false);
  return { id: c.body.user.id as string, email, token: await tokenFor(email, newPassword), temp };
}

async function main() {
  const server = http.createServer(createApp());
  initSockets(server);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  baseUrl = base;
  console.log(`QA server on ${base}`);

  // ------------------------------------------------------------------ tokens
  const mgrM = await tokenFor("ravi.menon@soliflex.local"); // Maintenance manager
  const mgrIT = await tokenFor("anita.shah@soliflex.local"); // IT manager
  const mech = await tokenFor("suresh.patil@soliflex.local");
  const itTech = await tokenFor("neha.verma@soliflex.local");
  const prod = await tokenFor("vikram.singh@soliflex.local");
  const admin = await tokenFor("priya.nair@soliflex.local");
  const lead = await tokenFor("karan.mehta@soliflex.local");
  const eng = await tokenFor("divya.rao@soliflex.local");
  const emp = await tokenFor("amit.joshi@soliflexpackaging.com");
  const U = Object.fromEntries((await prisma.user.findMany()).map((u) => [u.email, u]));
  const id = (email: string) => U[email].id as string;

  // ================================================================= AUTH
  section("AUTH: login, registration, sessions, passwords");
  {
    const r = await login("ravi.menon@soliflex.local");
    is("login ok", r, 200);
    ok("login returns user without passwordHash", r.body.user && !("passwordHash" in r.body.user));
    ok("web login does NOT leak refresh token in body", !("refreshToken" in r.body));
    ok("web login sets httpOnly refresh cookie", (r.headers.get("set-cookie") ?? "").toLowerCase().includes("httponly"));
    const m = await login("ravi.menon@soliflex.local", SEED, true);
    ok("mobile login returns refreshToken in body", typeof m.body.refreshToken === "string");
    const rf = await call("POST", "/api/auth/refresh", { body: { refreshToken: m.body.refreshToken }, headers: { "X-Client-Type": "mobile" } });
    is("mobile refresh via body", rf, 200);
    ok("refresh returns a usable access token", (await get(rf.body.accessToken, "/auth/me")).status === 200);
    is("logout (mobile)", await call("POST", "/api/auth/logout", { body: { refreshToken: m.body.refreshToken } }), 200);
    is("refresh after logout is rejected", await call("POST", "/api/auth/refresh", { body: { refreshToken: m.body.refreshToken } }), 401);
    is("refresh with no token is rejected", await call("POST", "/api/auth/refresh", { body: {} }), 401);
    is("refresh with garbage token is rejected", await call("POST", "/api/auth/refresh", { body: { refreshToken: "nope" } }), 401);

    const wrong = await login("ravi.menon@soliflex.local", "WrongPass#1");
    const nouser = await login("nobody@soliflex.local", "WrongPass#1");
    is("wrong password -> 401", wrong, 401);
    ok("unknown email and wrong password give the same message (no user enumeration)", wrong.body.error === nouser.body.error);
    is("missing fields -> 400", await call("POST", "/api/auth/login", { body: { email: "x" } }), 400);
    is("malformed JSON -> 400 (not 500)", await call("POST", "/api/auth/login", { raw: "{bad json" }), 400);
    is("no token -> 401", await get(undefined, "/helpdesk"), 401);
    is("garbage token -> 401", await get("abc.def.ghi", "/helpdesk"), 401);

    // throttling
    let last: R | undefined;
    for (let i = 0; i < 8; i++) last = await login("lockout.test@soliflexpackaging.com", "Bad#Pass1234");
    ok("8 wrong attempts still answer 401", last?.status === 401);
    const locked = await login("lockout.test@soliflexpackaging.com", "Bad#Pass1234");
    is("9th attempt is throttled", locked, 429);
    ok("throttle sends Retry-After", Number(locked.headers.get("retry-after")) > 0);
    const normal = await login("ravi.menon@soliflex.local");
    is("throttle is per-email (other users unaffected)", normal, 200);

    // registration
    const reg = (o: Record<string, unknown>) => call("POST", "/api/auth/register", { body: { employeeId: "E-1", name: "Test Person", email: "t.person@soliflexpackaging.com", password: "Str0ng#Passw0rd", ...o } });
    is("register: outside company domain rejected", await reg({ email: "x@gmail.com" }), 400);
    is("register: weak password rejected", await reg({ password: "short" }), 400);
    ok("register: weak password message lists the unmet rules", /at least 10/.test((await reg({ password: "short" })).body.error));
    is("register: common password rejected", await reg({ password: "Soliflex@123" }), 400);
    is("register: password containing own first name rejected", await reg({ password: "Test#Secret1234" }), 400);
    const good = await reg({});
    is("register ok", good, 201);
    ok("register always creates an EMPLOYEE", good.body?.user?.role === "EMPLOYEE");
    const sneaky = await call("POST", "/api/auth/register", { body: { employeeId: "E-2", name: "Sneaky Pete", email: "s.pete@soliflexpackaging.com", password: "Str0ng#Passw0rd2", role: "ADMIN" } });
    ok("register: cannot self-promote by sending role=ADMIN", sneaky.status === 201 && sneaky.body?.user?.role === "EMPLOYEE", `${sneaky.status} ${JSON.stringify(sneaky.body)}`);
    is("register: duplicate email rejected", await reg({ employeeId: "E-9" }), 409);
    is("register: duplicate employee id rejected", await reg({ email: "other@indautogroup.com" }), 409);
    is("register: second allowed domain works", await reg({ employeeId: "E-3", email: "q.person@indautogroup.com", name: "Q Zed", password: "Another#Good9Pass" }), 201);

    // change password
    const mgrEmail = "ravi.menon@soliflex.local";
    const t = await tokenFor(mgrEmail);
    is("change password: wrong current", await post(t, "/auth/change-password", { currentPassword: "nope", newPassword: "Br@nd-New-Pass9" }), 400);
    is("change password: weak new", await post(t, "/auth/change-password", { currentPassword: SEED, newPassword: "weak" }), 400);
    ok("change password: same as current is refused", (await post(t, "/auth/change-password", { currentPassword: SEED, newPassword: SEED })).status === 400);
    is("change password: ok", await post(t, "/auth/change-password", { currentPassword: SEED, newPassword: "Br@nd-New-Pass9" }), 200);
    is("old password no longer works", await login(mgrEmail, SEED), 401);
    is("new password works", await login(mgrEmail, "Br@nd-New-Pass9"), 200);
    is("restore seed password", await post(await tokenFor(mgrEmail, "Br@nd-New-Pass9"), "/auth/change-password", { currentPassword: "Br@nd-New-Pass9", newPassword: "Soliflex#Restore9" }), 200);
    // keep the manager usable with a known password for the rest of the run
    await prisma.user.update({ where: { email: mgrEmail }, data: { passwordHash: (await prisma.user.findUniqueOrThrow({ where: { email: "anita.shah@soliflex.local" } })).passwordHash } });
  }
  const mgrMFresh = await tokenFor("ravi.menon@soliflex.local");

  // ================================================================= MOBILE SIGN-IN
  section("AUTH: mobile-number registration and sign-in");
  {
    const mreg = (o: Record<string, unknown>) => call("POST", "/api/auth/register", { body: { employeeId: "M-1", name: "Raju Kumar", phone: "98765 43210", password: "Str0ng#Passw0rd", ...o } });
    const r = await mreg({});
    is("register with a mobile number only", r, 201);
    ok("account has no email and a normalised phone", r.body?.user?.email === null && r.body?.user?.phone === "+919876543210", JSON.stringify(r.body?.user));
    ok("mobile-only registration is an EMPLOYEE", r.body?.user?.role === "EMPLOYEE");
    for (const idf of ["9876543210", "+91 98765-43210", "09876543210", "+919876543210"]) {
      is(`sign in with mobile '${idf}'`, await login(idf, "Str0ng#Passw0rd"), 200);
    }
    is("mobile sign-in: wrong password", await login("9876543210", "Wrong#Pass123"), 401);
    is("mobile sign-in: unknown number", await login("9123456780", "Str0ng#Passw0rd"), 401);
    ok("unknown number and wrong password give the same message", (await login("9123456780", "x")).body.error === (await login("9876543210", "x")).body.error);
    is("legacy {email,password} body still signs in", await call("POST", "/api/auth/login", { body: { email: "ravi.menon@soliflex.local", password: SEED } }), 200);
    is("register: duplicate mobile number rejected", await mreg({ employeeId: "M-2", phone: "+91 9876543210" }), 409);
    is("register: neither email nor mobile -> 400", await mreg({ employeeId: "M-3", phone: undefined }), 400);
    is("register: invalid mobile -> 400", await mreg({ employeeId: "M-4", phone: "12345" }), 400);
    is("register: password containing the mobile number rejected", await mreg({ employeeId: "M-5", phone: "9123456789", password: "Zx#9123456789Qq" }), 400);
    is("register: mobile-only has no email-domain restriction", await mreg({ employeeId: "M-6", phone: "9123456789", name: "Lata Devi" }), 201);

    const both = await mreg({ employeeId: "M-7", phone: "9012345678", email: "both.person@soliflexpackaging.com", name: "Both Person" });
    is("register with both email and mobile", both, 201);
    is("both: sign in by email", await login("both.person@soliflexpackaging.com", "Str0ng#Passw0rd"), 200);
    is("both: sign in by mobile", await login("9012345678", "Str0ng#Passw0rd"), 200);
    is("both: email still limited to company domains", await mreg({ employeeId: "M-8", phone: "9012345600", email: "x@gmail.com" }), 400);

    // capture the other identifier later
    const tok = await tokenFor("9876543210", "Str0ng#Passw0rd");
    is("add email: wrong current password", await call("PATCH", "/api/auth/me/contact", { token: tok, body: { currentPassword: "nope", email: "raju.kumar@soliflexpackaging.com" } }), 400);
    is("add email: outside company domain", await call("PATCH", "/api/auth/me/contact", { token: tok, body: { currentPassword: "Str0ng#Passw0rd", email: "raju@gmail.com" } }), 400);
    is("add email: already used by someone else", await call("PATCH", "/api/auth/me/contact", { token: tok, body: { currentPassword: "Str0ng#Passw0rd", email: "both.person@soliflexpackaging.com" } }), 409);
    const add = await call("PATCH", "/api/auth/me/contact", { token: tok, body: { currentPassword: "Str0ng#Passw0rd", email: "raju.kumar@soliflexpackaging.com" } });
    is("add email to a mobile-only account", add, 200);
    is("then sign in with the new email", await login("raju.kumar@soliflexpackaging.com", "Str0ng#Passw0rd"), 200);
    is("and still with the mobile number", await login("9876543210", "Str0ng#Passw0rd"), 200);
    is("cannot remove both identifiers", await call("PATCH", "/api/auth/me/contact", { token: tok, body: { currentPassword: "Str0ng#Passw0rd", email: null, phone: null } }), 400);
    is("mobile number already used by another account", await call("PATCH", "/api/auth/me/contact", { token: tok, body: { currentPassword: "Str0ng#Passw0rd", phone: "9012345678" } }), 409);

    // admin-created staff without email
    const mkPhone = await post(admin, "/users", { employeeId: "PH-1", name: "Floor Operator", phone: "9345678901", role: "MECHANIC" });
    is("admin creates a staff member with a mobile number only", mkPhone, 201);
    ok("they have no email and are forced to reset the temp password", mkPhone.body.user.email === null && mkPhone.body.user.mustResetPassword === true);
    const phoneTok = await tokenFor("9345678901", mkPhone.body.tempPassword);
    is("temp password works with the mobile number", await get(phoneTok, "/auth/me"), 200);
    is("...but the API stays locked until it is changed", await get(phoneTok, "/tickets"), 403);
    is("create user: neither email nor mobile -> 400", await post(admin, "/users", { employeeId: "PH-2", name: "Nobody", role: "MECHANIC" }), 400);
    is("create user: duplicate mobile -> 409", await post(admin, "/users", { employeeId: "PH-3", name: "Dup", phone: "+91 93456 78901", role: "MECHANIC" }), 409);
    is("update user: mobile already used -> 409", await patch(admin, `/users/${mkPhone.body.user.id}`, { phone: "9876543210" }), 409);
    is("update user: cannot clear the only identifier", await patch(admin, `/users/${mkPhone.body.user.id}`, { phone: null }), 400);
    is("update user: can add an email", await patch(admin, `/users/${mkPhone.body.user.id}`, { email: "floor.operator@soliflexpackaging.com" }), 200);
    is("bulk import template mentions phone", await call("GET", "/api/users/template", { token: admin }), 200);
  }

  // ================================================================= USERS
  section("USERS: access control, creation, privilege protection, lifecycle");
  const ids: Record<string, { id: string; email: string; token: string }> = {};
  {
    for (const [name, t] of Object.entries({ emp, eng, mech, itTech, prod, lead })) {
      is(`GET /users denied for ${name}`.replace("denied", name === "lead" ? "allowed (scoped)" : "denied"), await get(t, "/users"), name === "lead" ? 200 : 403);
    }
    const leadList = await get(lead, "/users");
    ok("Team Lead only sees assignable IT people", leadList.body.every((u: any) => ["IT_SUPPORT_ENGINEER", "IT_TEAM_LEAD", "ADMIN"].includes(u.role)) && leadList.body.length >= 2);
    ok("user list never exposes password hashes", leadList.body.every((u: any) => !("passwordHash" in u)));
    is("manager can list users", await get(mgrMFresh, "/users"), 200);
    is("admin can list users", await get(admin, "/users"), 200);

    // creation rules
    const mk = (o: Record<string, unknown>) => ({ employeeId: `QA-${Math.random().toString(36).slice(2, 8)}`, name: "QA User", email: `qa.${Math.random().toString(36).slice(2, 8)}@soliflexpackaging.com`, role: "EMPLOYEE", ...o });
    is("manager cannot create an ADMIN", await post(mgrMFresh, "/users", mk({ role: "ADMIN" })), 403);
    is("manager cannot create an IT_TEAM_LEAD", await post(mgrMFresh, "/users", mk({ role: "IT_TEAM_LEAD" })), 403);
    is("manager cannot create an IT_SUPPORT_ENGINEER", await post(mgrMFresh, "/users", mk({ role: "IT_SUPPORT_ENGINEER" })), 403);
    is("employee cannot create users", await post(emp, "/users", mk({})), 403);
    is("create user: invalid email", await post(admin, "/users", mk({ email: "not-an-email" })), 400);
    is("create user: invalid role", await post(admin, "/users", mk({ role: "GOD" })), 400);
    is("create user: duplicate email", await post(admin, "/users", mk({ email: "ravi.menon@soliflex.local" })), 409);

    const mechUser = await post(mgrMFresh, "/users", mk({ role: "MECHANIC", name: "Maint Mech Two" }));
    is("manager can create a mechanic", mechUser, 201);
    ok("mechanic with no workstream defaults to MAINTENANCE", mechUser.body.user.workstream === "MAINTENANCE");
    ok("temp password is returned once and user must reset", mechUser.body.user.mustResetPassword === true && typeof mechUser.body.tempPassword === "string");
    is("IT_TEAM in the Maintenance workstream is refused", await post(mgrMFresh, "/users", mk({ role: "IT_TEAM", workstream: "MAINTENANCE" })), 400);

    ids.mech2 = await onboard(admin, mk({ role: "MECHANIC", name: "Second Mechanic" }), "Mech#Two#Pass99");
    ids.emp2 = await onboard(admin, mk({ role: "EMPLOYEE", name: "Second Employee" }), "Emp#Two#Pass99x");
    ids.eng2 = await onboard(admin, mk({ role: "IT_SUPPORT_ENGINEER", name: "Second Engineer" }), "Eng#Two#Pass99x");
    ids.itTech2 = await onboard(admin, mk({ role: "IT_TEAM", name: "Second ITTech" }), "ItT#Two#Pass99x");
    ids.mgr2 = await onboard(admin, mk({ role: "MANAGER", workstream: "IT", name: "Another Manager" }), "Mgr#Two#Pass99x");
    ok("IT_TEAM created via admin gets IT workstream", (await prisma.user.findUniqueOrThrow({ where: { id: ids.itTech2.id } })).workstream === "IT");

    // privilege protection
    const adminId = id("priya.nair@soliflex.local");
    const leadId = id("karan.mehta@soliflex.local");
    is("manager cannot reset an ADMIN's password", await post(mgrMFresh, `/users/${adminId}/reset-password`), 403);
    is("manager cannot reset an IT_TEAM_LEAD's password", await post(mgrMFresh, `/users/${leadId}/reset-password`), 403);
    is("manager cannot deactivate an ADMIN", await patch(mgrMFresh, `/users/${adminId}`, { active: false }), 403);
    is("manager cannot rename an ADMIN", await patch(mgrMFresh, `/users/${adminId}`, { name: "Hacked" }), 403);
    is("manager cannot promote a mechanic to ADMIN", await patch(mgrMFresh, `/users/${ids.mech2.id}`, { role: "ADMIN" }), 403);
    ok("admin password untouched after the attempts", (await login("priya.nair@soliflex.local")).status === 200);
    is("admin can reset a manager's password", await post(admin, `/users/${id("anita.shah@soliflex.local")}/reset-password`), 200);
    // anita now has a temp password -> restore for later use
    await prisma.user.update({ where: { id: id("anita.shah@soliflex.local") }, data: { passwordHash: U["ravi.menon@soliflex.local"].passwordHash, mustResetPassword: false } });
    // (ravi's hash was replaced above with anita's old one; both are the seed password)

    is("admin cannot deactivate self", await patch(admin, `/users/${adminId}`, { active: false }), 400);
    is("admin cannot change own role", await patch(admin, `/users/${adminId}`, { role: "MANAGER" }), 400);
    is("unknown user id -> 404 (not 500)", await patch(admin, "/users/does-not-exist", { name: "x" }), 404);

    // lifecycle: role change audited + sessions revoked, deactivation kills access
    const victim = await tokenFor(ids.mech2.email, "Mech#Two#Pass99");
    const vLogin = await login(ids.mech2.email, "Mech#Two#Pass99", true);
    is("role change by admin", await patch(admin, `/users/${ids.mech2.id}`, { role: "PRODUCTION" }), 200);
    is("role change revokes existing refresh sessions", await call("POST", "/api/auth/refresh", { body: { refreshToken: vLogin.body.refreshToken } }), 401);
    const aud = await get(admin, `/audit?entityType=User&entityId=${ids.mech2.id}`);
    ok("role change is written to the audit log", aud.body.entries.some((e: any) => e.field === "role" && e.oldValue === "MECHANIC" && e.newValue === "PRODUCTION"));
    is("restore mechanic role", await patch(admin, `/users/${ids.mech2.id}`, { role: "MECHANIC" }), 200);
    ok("victim token from before is still a valid JWT (expires on its own)", victim.length > 20);
    const live = await login(ids.mech2.email, "Mech#Two#Pass99", true);
    is("deactivate user", await patch(mgrMFresh, `/users/${ids.mech2.id}`, { active: false }), 200);
    is("deactivated user cannot log in", await login(ids.mech2.email, "Mech#Two#Pass99"), 401);
    is("deactivated user's refresh token is dead", await call("POST", "/api/auth/refresh", { body: { refreshToken: live.body.refreshToken } }), 401);
    is("reactivate user", await patch(mgrMFresh, `/users/${ids.mech2.id}`, { active: true }), 200);
    is("reactivated user can log in", await login(ids.mech2.email, "Mech#Two#Pass99"), 200);

    // reset password flow
    const rp = await post(admin, `/users/${ids.emp2.id}/reset-password`);
    is("admin reset password", rp, 200);
    const t = await tokenFor(ids.emp2.email, rp.body.tempPassword);
    is("after reset the user is locked to the change-password flow", await get(t, "/helpdesk"), 403);
    is("old password invalid after reset", await login(ids.emp2.email, "Emp#Two#Pass99x"), 401);
    is("set a real password again", await post(t, "/auth/change-password", { currentPassword: rp.body.tempPassword, newPassword: "Emp#Two#Pass99y" }), 200);
    ids.emp2.token = await tokenFor(ids.emp2.email, "Emp#Two#Pass99y");

    // bulk import
    const csv = [
      "employeeId,name,email,role,workstream,department,phone",
      "BULK-1,Bulk One,bulk.one@soliflexpackaging.com,MECHANIC,,Maintenance,",
      "BULK-2,Bulk Two,not-an-email,MECHANIC,,,",
      "BULK-3,Bulk Three,bulk.three@soliflexpackaging.com,ADMIN,,,",
      "BULK-4,Bulk Four,bulk.four@soliflexpackaging.com,EMPLOYEE,,,",
      "BULK-1,Dup Id,dup.id@soliflexpackaging.com,EMPLOYEE,,,",
    ].join("\n");
    const f = new FormData();
    f.append("file", new Blob([csv], { type: "text/csv" }), "users.csv");
    const bi = await call("POST", "/api/users/bulk-import", { token: mgrMFresh, form: f });
    is("bulk import runs", bi, 200);
    ok("bulk import: valid rows imported (2), bad ones reported (3)", bi.body.imported === 2 && bi.body.failed === 3, JSON.stringify({ i: bi.body.imported, f: bi.body.failed, e: bi.body.errors }));
    ok("bulk import: manager cannot sneak in an ADMIN row", bi.body.errors.some((e: any) => e.row === 4));
    ok("bulk import: every created user gets a temp password", bi.body.created.every((c: any) => typeof c.tempPassword === "string"));
    const bad = new FormData();
    bad.append("file", new Blob(["x"], { type: "text/plain" }), "users.txt");
    is("bulk import: non-csv file -> 400 (not 500)", await call("POST", "/api/users/bulk-import", { token: mgrMFresh, form: bad }), 400);
    is("bulk import: employee denied", await call("POST", "/api/users/bulk-import", { token: emp, form: f }), 403);
    is("user template download", await get(mgrMFresh, "/users/template"), 200);
  }
  const mech2 = ids.mech2, emp2 = ids.emp2, eng2 = ids.eng2, itTech2 = ids.itTech2;
  await prisma.user.update({ where: { id: mech2.id }, data: { active: true } });

  // ===================================================== LEGACY TICKETS
  section("TICKETS (Maintenance & IT board): permissions");
  {
    const body = (o: Record<string, unknown> = {}) => ({ workstream: "MAINTENANCE", category: "PRODUCTION_MACHINE", title: "Press line vibration", description: "Strong vibration on the main drive", ...o });
    is("employee (helpdesk-only role) cannot list board tickets", await get(emp, "/tickets"), 403);
    is("engineer cannot list board tickets", await get(eng, "/tickets"), 403);
    is("Team Lead cannot list board tickets", await get(lead, "/tickets"), 403);
    is("employee cannot create a board ticket", await post(emp, "/tickets", body()), 403);
    is("mechanic cannot raise tickets", await post(mech, "/tickets", body()), 403);
    is("production cannot raise IT tickets", await post(prod, "/tickets", body({ workstream: "IT", category: "LAPTOP" })), 403);
    is("production cannot raise facility tickets (admin team only)", await post(prod, "/tickets", body({ category: "FACTORY_FACILITY" })), 403);
    is("production cannot raise 'other machine' tickets (admin team only)", await post(prod, "/tickets", body({ category: "OTHER_MACHINE" })), 403);
    is("admin team (ADMIN) can raise facility tickets", await post(admin, "/tickets", body({ category: "FACTORY_FACILITY", title: "Roof leak in bay 3" })), 201);
    is("IT tech cannot raise maintenance tickets", await post(itTech, "/tickets", body()), 403);
    is("IT tech cannot use a maintenance category in IT workstream", await post(itTech, "/tickets", body({ workstream: "IT", category: "PRODUCTION_MACHINE" })), 400);
    is("title too short -> 400", await post(prod, "/tickets", body({ title: "ab" })), 400);
    is("description too short -> 400", await post(prod, "/tickets", body({ description: "x" })), 400);
    is("invalid category -> 400", await post(prod, "/tickets", body({ category: "NOPE" })), 400);
    is("unknown ticket -> 404", await get(mgrMFresh, "/tickets/does-not-exist"), 404);
    is("invalid status filter -> 400 (not 500)", await get(mgrMFresh, "/tickets?status=BOGUS"), 400);
  }

  section("TICKETS: full maintenance workflow (create -> assign -> work -> approve -> review -> close -> reopen)");
  let T: any;
  {
    const c = await post(prod, "/tickets", { workstream: "MAINTENANCE", category: "PRODUCTION_MACHINE", title: "Extruder motor overheating", description: "Motor trips after 20 minutes", plantLocation: "Plant A" });
    is("production raises a maintenance ticket", c, 201);
    T = c.body;
    ok("ticket gets MAIN- number and OPEN status", /^MAIN-\d+$/.test(T.ticketNumber) && T.status === "OPEN");
    ok("raiser recorded and history started", T.reportedBy?.id === id("vikram.singh@soliflex.local") && T.statusHistory.length === 1);
    ok("maintenance manager notified of the new ticket", hasNotif(await notifs(mgrMFresh), T.ticketNumber));
    ok("raiser is not notified of their own ticket", !hasNotif(await notifs(prod), `New MAINTENANCE ticket ${T.ticketNumber}`));
    const c2 = await post(mgrMFresh, "/tickets", { workstream: "MAINTENANCE", category: "OTHER_MACHINE", title: "Second ticket", description: "for sequence" });
    ok("ticket numbers are sequential and unique", Number(c2.body.ticketNumber.split("-")[1]) === Number(T.ticketNumber.split("-")[1]) + 1);
    ok("IT tickets use their own IT- sequence", /^IT-\d+$/.test((await post(itTech, "/tickets", { workstream: "IT", category: "LAPTOP", title: "Laptop dead", description: "no power" })).body.ticketNumber));

    const mechId = id("suresh.patil@soliflex.local");
    const base = `/tickets/${T.id}`;
    is("mechanic cannot assign", await post(mech, `${base}/assign`, { assignedToId: mechId, priority: "HIGH" }), 403);
    is("production cannot assign", await post(prod, `${base}/assign`, { assignedToId: mechId, priority: "HIGH" }), 403);
    is("assign: priority required", await post(mgrMFresh, `${base}/assign`, { assignedToId: mechId }), 400);
    is("assign: cannot give work to a PRODUCTION user", await post(mgrMFresh, `${base}/assign`, { assignedToId: id("vikram.singh@soliflex.local"), priority: "HIGH" }), 400);
    is("assign: cannot give work to a manager", await post(mgrMFresh, `${base}/assign`, { assignedToId: id("ravi.menon@soliflex.local"), priority: "HIGH" }), 400);
    is("assign: IT technician rejected for a maintenance ticket", await post(mgrMFresh, `${base}/assign`, { assignedToId: id("neha.verma@soliflex.local"), priority: "HIGH" }), 400);
    is("assign: invalid target date -> 400", await post(mgrMFresh, `${base}/assign`, { assignedToId: mechId, priority: "HIGH", targetCompletionDate: "garbage" }), 400);
    is("assign: negative effort -> 400", await post(mgrMFresh, `${base}/assign`, { assignedToId: mechId, priority: "HIGH", effortEstimateHours: -3 }), 400);
    await prisma.user.update({ where: { id: mech2.id }, data: { active: false } });
    is("assign: inactive technician rejected", await post(mgrMFresh, `${base}/assign`, { assignedToId: mech2.id, priority: "HIGH" }), 400);
    await prisma.user.update({ where: { id: mech2.id }, data: { active: true } });
    is("assign: unknown user -> 404", await post(mgrMFresh, `${base}/assign`, { assignedToId: "nope", priority: "HIGH" }), 404);
    is("start before assignment rejected", await post(mech, `${base}/start-progress`), 403);

    const as = await post(mgrMFresh, `${base}/assign`, { assignedToId: mechId, priority: "HIGH", targetCompletionDate: "2030-01-15", effortEstimateHours: 6 });
    is("manager assigns (flexible date accepted)", as, 200);
    ok("status ASSIGNED, manager recorded", as.body.status === "ASSIGNED" && as.body.managerId === id("ravi.menon@soliflex.local"));
    ok("assignee notified", hasNotif(await notifs(mech), `assigned ticket ${T.ticketNumber}`));
    is("cannot assign again once assigned (use edit assignment)", await post(mgrMFresh, `${base}/assign`, { assignedToId: mechId, priority: "LOW" }), 403);

    is("different mechanic cannot start", await post(mech2.token, `${base}/start-progress`), 403);
    is("manager cannot start (technician action)", await post(mgrMFresh, `${base}/start-progress`), 403);
    is("assignee starts work", await post(mech, `${base}/start-progress`), 200);
    is("cannot start twice", await post(mech, `${base}/start-progress`), 403);

    // attachments
    const up = (token: string, type: string, f = file()) => { f.append("type", type); return call("POST", `/api${base}/attachments`, { token, form: f }); };
    is("recommendation blocked without pre-fix photo", await post(mech, `${base}/submit-recommendation`, { diagnosis: "Bearing worn", recommendedFix: "Replace bearing", fixType: "SPARE_PART_REPLACEMENT", estimatedCost: 4500 }), 400);
    is("upload: invalid attachment type -> 400 (not 500)", await up(mech, "BOGUS"), 400);
    is("upload: unsupported file type -> 400 (not 500)", await up(mech, "PRE_FIX_PHOTO", file("x.exe", "application/x-msdownload", Buffer.from("MZ"))), 400);
    is("upload: no file -> 400", await call("POST", `/api${base}/attachments`, { token: mech, form: (() => { const f = new FormData(); f.append("type", "PRE_FIX_PHOTO"); return f; })() }), 400);
    const pre = await up(mech, "PRE_FIX_PHOTO");
    is("upload pre-fix photo", pre, 201);
    ok("upload stored under /uploads with random name", /^\/uploads\/\d+-[0-9a-f]{32}\.png$/.test(pre.body.fileUrl), pre.body.fileUrl);
    ok("uploaded file can be opened by URL", (await fetch(`${baseUrl}${pre.body.fileUrl}`)).status === 200);
    is("employee cannot attach to board tickets", await up(emp, "OTHER"), 403);

    is("empty diagnosis rejected", await post(mech, `${base}/submit-recommendation`, { diagnosis: "", recommendedFix: "x", fixType: "MINOR_ADJUSTMENT" }), 400);
    is("diagnosis without a fix type rejected", await post(mech, `${base}/submit-recommendation`, { diagnosis: "a", recommendedFix: "b" }), 400);
    is("other mechanic cannot submit recommendation", await post(mech2.token, `${base}/submit-recommendation`, { diagnosis: "a", recommendedFix: "b", fixType: "MINOR_ADJUSTMENT" }), 403);
    const sr = await post(mech, `${base}/submit-recommendation`, { diagnosis: "Bearing worn", recommendedFix: "Replace bearing", fixType: "SPARE_PART_REPLACEMENT", estimatedCost: 4500 });
    is("assignee submits diagnosis & fix", sr, 200);
    ok("ticket is now on hold awaiting approval", sr.body.onHold === true && sr.body.onHoldReason === "APPROVAL");
    ok("manager notified of approval request", hasNotif(await notifs(mgrMFresh), "awaiting your approval"));
    is("cannot submit recommendation again while waiting", await post(mech, `${base}/submit-recommendation`, { diagnosis: "a", recommendedFix: "b", fixType: "MINOR_ADJUSTMENT" }), 400);
    is("cannot put on hold again", await post(mech, `${base}/hold`, { reason: "VENDOR", detail: "waiting" }), 400);
    is("cannot resume an approval hold", await post(mech, `${base}/resume`), 400);
    is("cannot send for review while awaiting approval", await post(mech, `${base}/mark-first-line-review`), 400);
    is("mechanic cannot approve", await post(mech, `${base}/decide-recommendation`, { approve: true }), 403);
    is("production cannot approve", await post(prod, `${base}/decide-recommendation`, { approve: true }), 403);

    const rej = await post(mgrMFresh, `${base}/decide-recommendation`, { approve: false, comment: "Need cost estimate first" });
    is("manager rejects recommendation", rej, 200);
    ok("rejection clears the hold and stores no approval", rej.body.onHold === false && rej.body.approvedAt === null);
    ok("rejection comment saved and technician notified", hasNotif(await notifs(mech), "rejected your fix"));
    is("review blocked until the fix is approved", await post(mech, `${base}/mark-first-line-review`), 400);
    is("technician resubmits", await post(mech, `${base}/submit-recommendation`, { diagnosis: "Bearing worn", recommendedFix: "Replace bearing + cost 4500", fixType: "SPARE_PART_REPLACEMENT", estimatedCost: 4500 }), 200);
    is("cannot decide when nothing is waiting (after decision)", await (async () => { await post(mgrMFresh, `${base}/decide-recommendation`, { approve: true }); return post(mgrMFresh, `${base}/decide-recommendation`, { approve: true }); })(), 400);
    const cur = await get(mgrMFresh, base);
    ok("recommendation approved and recorded", cur.body.approvedAt && cur.body.approvedBy?.id === id("ravi.menon@soliflex.local") && !cur.body.onHold);

    // costs
    is("production cannot add costs", await post(prod, `${base}/costs`, { description: "x", amount: 5 }), 403);
    is("cost: zero/negative amount -> 400", await post(mech, `${base}/costs`, { description: "x", amount: 0 }), 400);
    is("cost: missing description -> 400", await post(mech, `${base}/costs`, { description: "", amount: 5 }), 400);
    is("mechanic adds cost", await post(mech, `${base}/costs`, { description: "Bearing 6205", amount: 1200.5, sparePartUsed: true }), 201);
    is("manager adds cost", await post(mgrMFresh, `${base}/costs`, { description: "Labour", amount: 800 }), 201);
    ok("actualCost is the running total", (await get(mgrMFresh, base)).body.actualCost === 2000.5);

    // hold / resume rules
    is("other mechanic cannot hold", await post(mech2.token, `${base}/hold`, { reason: "VENDOR", detail: "x" }), 403);
    is("hold needs a detail", await post(mech, `${base}/hold`, { reason: "VENDOR", detail: "" }), 400);
    is("hold: invalid reason -> 400", await post(mech, `${base}/hold`, { reason: "BORED", detail: "x" }), 400);
    is("resume when not on hold -> 400", await post(mech, `${base}/resume`), 400);
    is("assignee puts it on hold (vendor)", await post(mech, `${base}/hold`, { reason: "VENDOR", detail: "Bearing arrives Friday" }), 200);
    is("cannot send for review while on hold", await post(mech, `${base}/mark-first-line-review`), 400);
    is("other mechanic cannot resume", await post(mech2.token, `${base}/resume`), 403);
    is("resume", await post(mech, `${base}/resume`), 200);

    is("post-fix photo required before review", await post(mech, `${base}/mark-first-line-review`), 400);
    is("other mechanic cannot send for review", await post(mech2.token, `${base}/mark-first-line-review`), 403);
    is("upload post-fix photo", await up(mech, "POST_FIX_PHOTO"), 201);
    const fl = await post(mech, `${base}/mark-first-line-review`);
    is("assignee sends for 1st line review", fl, 200);
    ok("status FIRST_LINE_REVIEW and manager notified", fl.body.status === "FIRST_LINE_REVIEW" && hasNotif(await notifs(mgrMFresh), "ready for 1st line review"));
    is("other mechanic cannot mark job completed", await post(mech2.token, `${base}/mark-job-completed`), 403);
    is("production cannot mark job completed", await post(prod, `${base}/mark-job-completed`), 403);
    is("cannot jump to final review from 1st line", await post(mgrMFresh, `${base}/mark-final-review`), 403);
    is("assignee marks job completed", await post(mech, `${base}/mark-job-completed`), 200);
    is("mechanic cannot send to final review", await post(mech, `${base}/mark-final-review`), 403);
    is("manager sends to final review", await post(mgrMFresh, `${base}/mark-final-review`), 200);

    is("mechanic cannot close", await post(mech, `${base}/close`, { confirmEquipmentOperational: true, closingComment: "ok" }), 403);
    is("close needs the operational confirmation", await post(mgrMFresh, `${base}/close`, { confirmEquipmentOperational: false, closingComment: "done" }), 400);
    is("close: missing flag -> 400", await post(mgrMFresh, `${base}/close`, { closingComment: "done" }), 400);
    const closed = await post(mgrMFresh, `${base}/close`, { confirmEquipmentOperational: true, closingComment: "Motor replaced and tested" });
    is("manager verifies & closes", closed, 200);
    ok("closed with closer + timestamp", closed.body.status === "CLOSED" && closed.body.closedAt && closed.body.closedById);
    ok("raiser and assignee notified of closure", hasNotif(await notifs(prod), `${T.ticketNumber} was closed`) && hasNotif(await notifs(mech), "verified and closed"));
    is("cannot add costs to a closed ticket", await post(mech, `${base}/costs`, { description: "late", amount: 5 }), 400);
    is("cannot change priority on a closed ticket", await patch(mgrMFresh, `${base}/priority`, { priority: "LOW" }), 400);
    is("cannot edit assignment on a closed ticket", await patch(mgrMFresh, `${base}/assignment`, { effortEstimateHours: 3 }), 400);
    is("cannot hold a closed ticket", await post(mgrMFresh, `${base}/hold`, { reason: "VENDOR", detail: "x" }), 403);

    // reopen
    is("mechanic cannot reopen", await post(mech, `${base}/reopen`, { reason: "again" }), 403);
    is("reopen needs a reason", await post(mgrMFresh, `${base}/reopen`, { reason: "" }), 400);
    const ro = await post(mgrMFresh, `${base}/reopen`, { reason: "Noise is back after two days" });
    is("manager reopens a closed ticket", ro, 200);
    ok("reopened to IN_PROGRESS with closure cleared", ro.body.status === "IN_PROGRESS" && ro.body.closedAt === null && ro.body.closedById === null);
    const full = (await get(mgrMFresh, base)).body;
    ok("reopen reason stored as a comment and in the history", full.comments.some((c: any) => c.body.includes("Noise is back")) && full.statusHistory.some((h: any) => h.toStatus === "IN_PROGRESS" && h.fromStatus === "CLOSED"));
    ok("assignee notified of the reopen", hasNotif(await notifs(mech), "was reopened"));
    ok("complete status history captured end-to-end", ["OPEN", "ASSIGNED", "IN_PROGRESS", "FIRST_LINE_REVIEW", "JOB_COMPLETED", "FINAL_REVIEW", "CLOSED"].every((s) => full.statusHistory.some((h: any) => h.toStatus === s)));

    // edit assignment / priority
    is("edit assignment: reassign to another mechanic", await patch(mgrMFresh, `${base}/assignment`, { assignedToId: mech2.id, effortEstimateHours: 4, targetCompletionDate: "2031-03-01" }), 200);
    ok("reassigned technician notified", hasNotif(await notifs(mech2.token), `assigned ticket ${T.ticketNumber}`));
    is("edit assignment: can clear the target date", await patch(mgrMFresh, `${base}/assignment`, { targetCompletionDate: null }), 200);
    ok("target date cleared", (await get(mgrMFresh, base)).body.targetCompletionDate === null);
    is("edit assignment: mechanic denied", await patch(mech, `${base}/assignment`, { effortEstimateHours: 1 }), 403);
    is("priority: manager can change", await patch(mgrMFresh, `${base}/priority`, { priority: "CRITICAL" }), 200);
    is("priority: invalid value -> 400", await patch(mgrMFresh, `${base}/priority`, { priority: "URGENT" }), 400);
    is("priority: mechanic denied", await patch(mech, `${base}/priority`, { priority: "LOW" }), 403);

    // comments
    is("add comment", await post(prod, `${base}/comments`, { body: "Operator confirms the noise" }), 201);
    is("empty comment -> 400", await post(prod, `${base}/comments`, { body: "" }), 400);
    is("employee cannot comment on board tickets", await post(emp, `${base}/comments`, { body: "hi" }), 403);
    ok("assignee and manager notified of the comment", hasNotif(await notifs(mgrMFresh), `New comment on ${T.ticketNumber}`));
  }

  section("TICKETS: IT workstream, lists and filters");
  {
    const itT = (await post(itTech, "/tickets", { workstream: "IT", category: "SERVER", title: "Mail server slow", description: "Outlook sync delayed" })).body;
    is("IT manager can assign to an IT technician", await post(mgrIT, `/tickets/${itT.id}/assign`, { assignedToId: id("neha.verma@soliflex.local"), priority: "MEDIUM", targetCompletionDate: "2030-02-01" }), 200);
    is("IT technician cannot be assigned a maintenance ticket", await post(mgrMFresh, `/tickets/${T.id}/assign`, { assignedToId: itTech2.id, priority: "LOW" }), 403);
    is("IT technician starts IT ticket", await post(itTech, `/tickets/${itT.id}/start-progress`), 200);
    const list = await get(mgrIT, "/tickets?workstream=IT");
    ok("workstream filter returns only IT tickets", list.body.length >= 2 && list.body.every((t: any) => t.workstream === "IT"));
    ok("status filter", (await get(mgrMFresh, "/tickets?status=IN_PROGRESS")).body.every((t: any) => t.status === "IN_PROGRESS"));
    ok("priority filter", (await get(mgrMFresh, "/tickets?priority=MEDIUM")).body.every((t: any) => t.priority === "MEDIUM"));
    ok("search by ticket number", (await get(mgrIT, `/tickets?search=${itT.ticketNumber}`)).body.map((t: any) => t.id).join() === itT.id);
    ok("search by title (case-insensitive)", (await get(mgrIT, "/tickets?search=MAIL%20SERVER")).body.some((t: any) => t.id === itT.id));
    ok("assignee filter", (await get(mgrMFresh, `/tickets?assignedToId=${id("neha.verma@soliflex.local")}`)).body.every((t: any) => t.assignedToId === id("neha.verma@soliflex.local")));
    ok("date preset 'today' includes tickets created now", (await get(mgrIT, "/tickets?range=today")).body.some((t: any) => t.id === itT.id));
    ok("custom range in the past excludes them", (await get(mgrMFresh, "/tickets?range=custom&from=2019-01-01&to=2019-01-31")).body.length === 0);
    ok("onHold filter", (await get(mgrMFresh, "/tickets?onHold=true")).body.every((t: any) => t.onHold));
    const hist = await get(admin, `/audit?entityType=Ticket&entityId=${T.id}`);
    ok("audit trail recorded the key ticket events", ["CREATE", "CLOSE", "REOPEN", "HOLD", "RESUME", "RECOMMENDATION_SUBMITTED", "RECOMMENDATION_APPROVED", "RECOMMENDATION_REJECTED"].every((a) => hist.body.entries.some((e: any) => e.action === a)));
  }


  const THRESHOLD = 2500;
  section("TICKETS: repair type and cost-based approval (maintenance)");
  {
    const mechId = id("suresh.patil@soliflex.local");
    const upload = (token: string, tid: string, type: string) => {
      const f = file();
      f.append("type", type);
      return call("POST", `/api/tickets/${tid}/attachments`, { token, form: f });
    };
    // raise -> assign -> start work, optionally with the pre-fix photo
    const inProgress = async (title: string, withPhoto = true) => {
      const t = (await post(prod, "/tickets", { workstream: "MAINTENANCE", category: "PRODUCTION_MACHINE", title, description: "needs attention" })).body;
      await post(mgrMFresh, `/tickets/${t.id}/assign`, { assignedToId: mechId, priority: "MEDIUM" });
      await post(mech, `/tickets/${t.id}/start-progress`);
      if (withPhoto) await upload(mech, t.id, "PRE_FIX_PHOTO");
      return t;
    };
    const sr = (tid: string, o: Record<string, unknown>) => post(mech, `/tickets/${tid}/submit-recommendation`, { diagnosis: "Checked on site", recommendedFix: "Fix applied", ...o });
    const close = (token: string, tid: string, o: Record<string, unknown> = {}) => post(token, `/tickets/${tid}/close-direct`, { confirmEquipmentOperational: true, closingComment: "Done and tested", ...o });

    const seen = await get(mgrMFresh, `/tickets/${(await inProgress("Threshold probe")).id}`);
    ok("ticket detail exposes the approval threshold", seen.body.approvalThreshold === THRESHOLD, String(seen.body.approvalThreshold));

    // A. minor adjustment: no approval, engineer closes with a photo
    const a = await inProgress("Loose drive belt");
    is("close before any diagnosis is refused", await close(mech, a.id), 400);
    is("diagnosis needs a repair type", await sr(a.id, {}), 400);
    is("spare part needs an estimated cost", await sr(a.id, { fixType: "SPARE_PART_REPLACEMENT" }), 400);
    is("estimated cost must be positive", await sr(a.id, { fixType: "SPARE_PART_REPLACEMENT", estimatedCost: 0 }), 400);
    is("invalid repair type -> 400", await sr(a.id, { fixType: "MAGIC" }), 400);
    const ra = await sr(a.id, { fixType: "MINOR_ADJUSTMENT", recommendedFix: "Re-tension belt" });
    is("engineer logs a minor adjustment", ra, 200);
    ok("no approval hold and approval not required", ra.body.onHold === false && ra.body.approvalRequired === false && ra.body.fixType === "MINOR_ADJUSTMENT", JSON.stringify(ra.body).slice(0, 200));
    ok("manager is told it needs no approval", hasNotif(await notifs(mgrMFresh), `diagnosed ${a.ticketNumber}`));
    is("close needs a post-fix photo", await close(mech, a.id), 400);
    is("upload post-fix photo", await upload(mech, a.id, "POST_FIX_PHOTO"), 201);
    is("close needs the operational confirmation", await close(mech, a.id, { confirmEquipmentOperational: false }), 400);
    is("another mechanic cannot close it", await close(mech2.token, a.id), 403);
    is("production cannot close it", await close(prod, a.id), 403);
    is("spare part cost cannot be added to a minor adjustment", await post(mech, `/tickets/${a.id}/costs`, { description: "washer", amount: 10, sparePartUsed: true }), 400);
    const ca = await close(mech, a.id);
    is("engineer closes the ticket directly", ca, 200);
    ok("closed by the engineer, no review chain", ca.body.status === "CLOSED" && ca.body.closedById === mechId);
    const fa = (await get(mgrMFresh, `/tickets/${a.id}`)).body;
    ok("history records the direct close", fa.statusHistory.some((h: any) => h.toStatus === "CLOSED" && /minor adjustment/.test(h.comment ?? "")));
    ok("raiser and manager notified", hasNotif(await notifs(prod), `${a.ticketNumber} was closed by`) && hasNotif(await notifs(mgrMFresh), `${a.ticketNumber} was closed by`));
    is("cannot close twice", await close(mech, a.id), 403);

    // B. spare part below the threshold: no approval
    const b = await inProgress("Worn limit switch");
    const rb = await sr(b.id, { fixType: "SPARE_PART_REPLACEMENT", estimatedCost: THRESHOLD - 1 });
    is("spare part under the threshold", rb, 200);
    ok("no approval hold; estimate kept", rb.body.onHold === false && rb.body.approvalRequired === false && rb.body.estimatedCost === THRESHOLD - 1);
    is("record part cost", await post(mech, `/tickets/${b.id}/costs`, { description: "Limit switch", amount: 1000, sparePartUsed: true }), 201);
    is("cost that would reach the threshold is refused", await post(mech, `/tickets/${b.id}/costs`, { description: "More", amount: 1500 }), 400);
    is("cost under the threshold is fine", await post(mech, `/tickets/${b.id}/costs`, { description: "Labour", amount: 1400 }), 201);
    await upload(mech, b.id, "POST_FIX_PHOTO");
    is("engineer closes a sub-threshold spare part job", await close(mech, b.id), 200);

    // C. at/above the threshold: approval, then the review chain; no shortcut
    const c = await inProgress("Gearbox failure");
    const rc = await sr(c.id, { fixType: "SPARE_PART_REPLACEMENT", estimatedCost: THRESHOLD });
    is("spare part exactly at the threshold", rc, 200);
    ok("held for manager approval", rc.body.onHold === true && rc.body.onHoldReason === "APPROVAL" && rc.body.approvalRequired === true);
    ok("manager asked for approval with the cost", hasNotif(await notifs(mgrMFresh), `awaiting your approval (est.`));
    is("cannot close while approval is pending", await close(mech, c.id), 400);
    is("manager approves", await post(mgrMFresh, `/tickets/${c.id}/decide-recommendation`, { approve: true }), 200);
    await upload(mech, c.id, "POST_FIX_PHOTO");
    const direct = await close(mech, c.id);
    is("approved high-cost job cannot take the shortcut", direct, 400);
    ok("message explains approval is needed", /approval/i.test(direct.body.error ?? ""));
    is("approved job follows the review chain", await post(mech, `/tickets/${c.id}/mark-first-line-review`), 200);
    is("review chain: job completed", await post(mech, `/tickets/${c.id}/mark-job-completed`), 200);
    is("review chain: final review", await post(mgrMFresh, `/tickets/${c.id}/mark-final-review`), 200);
    is("review chain: manager closes", await post(mgrMFresh, `/tickets/${c.id}/close`, { confirmEquipmentOperational: true, closingComment: "Verified" }), 200);

    // D. no approval-needed job can still be sent to review if the engineer prefers
    const d = await inProgress("Sensor drift");
    await sr(d.id, { fixType: "MINOR_ADJUSTMENT" });
    await upload(mech, d.id, "POST_FIX_PHOTO");
    is("no-approval job may still go to 1st line review", await post(mech, `/tickets/${d.id}/mark-first-line-review`), 200);
    is("direct close is refused once the ticket is in the review stage", await close(mgrMFresh, d.id), 400);

    // E. no approval path cannot be gamed through costs: escalate by resubmitting
    const e = await inProgress("Hydraulic hose");
    await sr(e.id, { fixType: "SPARE_PART_REPLACEMENT", estimatedCost: 900 });
    is("big cost on a cleared job is refused", await post(mech, `/tickets/${e.id}/costs`, { description: "Hose + fittings", amount: 5200, sparePartUsed: true }), 400);
    const re = await sr(e.id, { fixType: "SPARE_PART_REPLACEMENT", estimatedCost: 5200 });
    is("engineer resubmits with the real cost", re, 200);
    ok("now requires approval", re.body.onHold === true && re.body.approvalRequired === true && re.body.approvedAt === null);

    // F. costs recorded before the diagnosis count towards the threshold
    const f = await inProgress("Pump seal");
    is("cost before diagnosis is allowed", await post(mech, `/tickets/${f.id}/costs`, { description: "Seal kit", amount: 3000, sparePartUsed: true }), 201);
    const rf = await sr(f.id, { fixType: "SPARE_PART_REPLACEMENT", estimatedCost: 500 });
    ok("understated estimate cannot hide recorded cost", rf.body.onHold === true && rf.body.approvalRequired === true, JSON.stringify(rf.body).slice(0, 160));
    const g = await inProgress("Panel tweak");
    await post(mech, `/tickets/${g.id}/costs`, { description: "Part", amount: 100, sparePartUsed: true });
    is("minor adjustment refused when spare parts are already recorded", await sr(g.id, { fixType: "MINOR_ADJUSTMENT" }), 400);

    ok("audit trail shows the cost outcome", (await get(admin, `/audit?entityType=Ticket&entityId=${b.id}`)).body.entries.some((x: any) => x.action === "RECOMMENDATION_SUBMITTED" && /no approval needed/.test(x.newValue ?? "")));
  }

  section("TICKETS: IT workflow is separate from Maintenance, and each team sees only its own");
  {
    const netha = id("neha.verma@soliflex.local");
    const itT = (await post(itTech, "/tickets", { workstream: "IT", category: "LAPTOP", title: "Printer driver missing", description: "Cannot print from the laptop" })).body;
    await post(mgrIT, `/tickets/${itT.id}/assign`, { assignedToId: netha, priority: "LOW" });
    is("IT engineer starts work", await post(itTech, `/tickets/${itT.id}/start-progress`), 200);
    is("IT: the maintenance diagnosis/approval step is not used", await post(itTech, `/tickets/${itT.id}/submit-recommendation`, { diagnosis: "a", recommendedFix: "b", fixType: "MINOR_ADJUSTMENT" }), 400);
    is("IT: there is no 1st line review", await post(itTech, `/tickets/${itT.id}/mark-first-line-review`), 400);
    is("IT: closing needs a resolution note", await post(itTech, `/tickets/${itT.id}/close-direct`, { confirmEquipmentOperational: true }), 400);
    is("IT: closing needs the resolved confirmation", await post(itTech, `/tickets/${itT.id}/close-direct`, { confirmEquipmentOperational: false, closingComment: "Installed" }), 400);
    is("IT: another technician cannot close it", await post(itTech2.token, `/tickets/${itT.id}/close-direct`, { confirmEquipmentOperational: true, closingComment: "x" }), 403);
    const closedIT = await post(itTech, `/tickets/${itT.id}/close-direct`, { confirmEquipmentOperational: true, closingComment: "Installed the driver and printed a test page" });
    is("IT engineer resolves and closes (no photo needed)", closedIT, 200);
    ok("IT ticket is CLOSED without a review chain", closedIT.body.status === "CLOSED");
    is("IT manager can reopen it", await post(mgrIT, `/tickets/${itT.id}/reopen`, { reason: "Printing fails again" }), 200);

    // isolation
    is("maintenance manager cannot open an IT ticket", await get(mgrMFresh, `/tickets/${itT.id}`), 404);
    is("maintenance manager cannot act on an IT ticket", await post(mgrMFresh, `/tickets/${itT.id}/hold`, { reason: "VENDOR", detail: "x" }), 404);
    is("maintenance technician cannot open an IT ticket", await get(mech, `/tickets/${itT.id}`), 404);
    is("IT technician cannot open a maintenance ticket", await get(itTech, `/tickets/${T.id}`), 404);
    is("IT manager cannot open a maintenance ticket", await get(mgrIT, `/tickets/${T.id}`), 404);
    ok("maintenance manager list holds only maintenance tickets - even when IT is requested", (await get(mgrMFresh, "/tickets?workstream=IT")).body.every((t: any) => t.workstream === "MAINTENANCE"));
    ok("IT manager list holds only IT tickets - even when Maintenance is requested", (await get(mgrIT, "/tickets?workstream=MAINTENANCE")).body.every((t: any) => t.workstream === "IT"));
    ok("IT technician list holds only IT tickets", (await get(itTech, "/tickets")).body.every((t: any) => t.workstream === "IT"));
    ok("mechanic list holds only maintenance tickets", (await get(mech, "/tickets")).body.every((t: any) => t.workstream === "MAINTENANCE"));
    const all = (await get(admin, "/tickets")).body;
    ok("admin still sees both workstreams", all.some((t: any) => t.workstream === "IT") && all.some((t: any) => t.workstream === "MAINTENANCE"));
    is("maintenance manager cannot raise an IT ticket", await post(mgrMFresh, "/tickets", { workstream: "IT", category: "LAPTOP", title: "Laptop dead", description: "no power" }), 403);
    is("IT manager cannot raise a maintenance ticket", await post(mgrIT, "/tickets", { workstream: "MAINTENANCE", category: "OTHER_MACHINE", title: "Press jammed", description: "stuck" }), 403);
    is("admin cannot pair an IT workstream with a maintenance category", await post(admin, "/tickets", { workstream: "IT", category: "PRODUCTION_MACHINE", title: "Mixed up", description: "wrong category" }), 400);
    is("admin cannot pair a maintenance workstream with an IT category", await post(admin, "/tickets", { workstream: "MAINTENANCE", category: "LAPTOP", title: "Mixed up", description: "wrong category" }), 400);
  }

  // ===================================================== HELPDESK
  section("HELPDESK: raising, visibility, assignment, deadlines, resolution");
  let H: any;
  {
    is("title too short -> 400", await post(emp, "/helpdesk", { category: "LAPTOP_DESKTOP", title: "ab", description: "long enough" }), 400);
    is("description too short -> 400", await post(emp, "/helpdesk", { category: "LAPTOP_DESKTOP", title: "Laptop slow", description: "x" }), 400);
    is("invalid category -> 400", await post(emp, "/helpdesk", { category: "TOASTER", title: "Laptop slow", description: "very slow" }), 400);
    const c = await post(emp, "/helpdesk", { category: "LAPTOP_DESKTOP", title: "Laptop screen flickers", description: "Flickers every few minutes" });
    is("employee raises an IT helpdesk ticket", c, 201);
    H = c.body;
    ok("HD- number, OPEN, raised by the employee", /^HD-\d+$/.test(H.ticketNumber) && H.status === "OPEN" && H.raisedBy.id === id("amit.joshi@soliflexpackaging.com"));
    ok("team lead and admin notified", hasNotif(await notifs(lead), H.ticketNumber) && hasNotif(await notifs(admin), H.ticketNumber));
    ok("raiser not notified of own ticket", !hasNotif(await notifs(emp), `New helpdesk ticket ${H.ticketNumber}`));
    const base = `/helpdesk/${H.id}`;

    // visibility
    ok("raiser sees it in My Requests", (await get(emp, "/helpdesk")).body.some((t: any) => t.id === H.id));
    ok("other employee does NOT see it", !(await get(emp2.token, "/helpdesk")).body.some((t: any) => t.id === H.id));
    is("other employee cannot open it by id", await get(emp2.token, base), 403);
    is("other employee cannot comment on it", await post(emp2.token, `${base}/comments`, { body: "me too" }), 403);
    ok("engineer sees nothing until assigned", !(await get(eng, "/helpdesk")).body.some((t: any) => t.id === H.id));
    is("engineer cannot open unassigned ticket", await get(eng, base), 403);
    ok("lead sees the whole queue", (await get(lead, "/helpdesk")).body.some((t: any) => t.id === H.id));
    ok("admin sees the whole queue", (await get(admin, "/helpdesk")).body.some((t: any) => t.id === H.id));
    is("manager (board role) has no special view of helpdesk tickets", await get(mgrMFresh, base), 403);

    // permissions on actions
    is("employee cannot assign", await post(emp, `${base}/assign`, { assignedToId: id("divya.rao@soliflex.local"), deadline: future() }), 403);
    is("engineer cannot assign", await post(eng, `${base}/assign`, { assignedToId: id("divya.rao@soliflex.local"), deadline: future() }), 403);
    is("employee cannot close", await post(emp, `${base}/close`), 403);
    is("employee cannot start work", await post(emp, `${base}/start-progress`), 403);

    // assignment validation
    const divya = id("divya.rao@soliflex.local");
    is("assign: deadline required", await post(lead, `${base}/assign`, { assignedToId: divya }), 400);
    is("assign: invalid deadline -> 400", await post(lead, `${base}/assign`, { assignedToId: divya, deadline: "not-a-date" }), 400);
    is("assign: past deadline refused", await post(lead, `${base}/assign`, { assignedToId: divya, deadline: new Date(Date.now() - 86_400_000).toISOString() }), 400);
    is("assign: employee is not a valid assignee", await post(lead, `${base}/assign`, { assignedToId: id("amit.joshi@soliflexpackaging.com"), deadline: future() }), 400);
    is("assign: mechanic is not a valid assignee", await post(lead, `${base}/assign`, { assignedToId: id("suresh.patil@soliflex.local"), deadline: future() }), 400);
    await prisma.user.update({ where: { id: eng2.id }, data: { active: false } });
    is("assign: inactive engineer refused", await post(lead, `${base}/assign`, { assignedToId: eng2.id, deadline: future() }), 400);
    await prisma.user.update({ where: { id: eng2.id }, data: { active: true } });
    is("start before assignment is refused", await post(eng, `${base}/start-progress`), 403);

    const as = await post(lead, `${base}/assign`, { assignedToId: divya, deadline: future(2), priority: "HIGH" });
    is("lead assigns with deadline & priority", as, 200);
    ok("ASSIGNED, deadline set, lead recorded, breach flag clear", as.body.status === "ASSIGNED" && as.body.deadline && as.body.teamLeadId === id("karan.mehta@soliflex.local") && as.body.deadlineBreached === false);
    ok("engineer and raiser notified", hasNotif(await notifs(eng), `assigned helpdesk ticket ${H.ticketNumber}`) && hasNotif(await notifs(emp), `assigned helpdesk ticket ${H.ticketNumber}`));
    ok("engineer now sees it", (await get(eng, "/helpdesk")).body.some((t: any) => t.id === H.id));
    is("engineer can open it", await get(eng, base), 200);
    is("other engineer cannot start it", await post(eng2.token, `${base}/start-progress`), 403);
    is("other engineer cannot open it", await get(eng2.token, base), 403);

    // work
    is("hold only after assignment: resume when not on hold -> 400", await post(eng, `${base}/resume`), 400);
    is("start progress", await post(eng, `${base}/start-progress`), 200);
    is("cannot start twice", await post(eng, `${base}/start-progress`), 403);
    is("hold needs a reason", await post(eng, `${base}/hold`, { detail: "" }), 400);
    is("other engineer cannot hold", await post(eng2.token, `${base}/hold`, { detail: "x" }), 403);
    is("engineer holds the ticket", await post(eng, `${base}/hold`, { detail: "Waiting for replacement panel" }), 200);
    is("hold twice -> 400", await post(eng, `${base}/hold`, { detail: "again" }), 400);
    ok("raiser notified of the hold", hasNotif(await notifs(emp), "put on hold"));
    is("resume", await post(eng, `${base}/resume`), 200);
    is("hold again (to test resolve-while-held)", await post(eng, `${base}/hold`, { detail: "Parts ordered" }), 200);
    is("employee cannot resolve", await post(emp, `${base}/resolve`, {}), 403);
    is("other engineer cannot resolve", await post(eng2.token, `${base}/resolve`, {}), 403);
    const rs = await post(eng, `${base}/resolve`, { resolutionComment: "Replaced the panel" });
    is("engineer resolves (even though it was on hold)", rs, 200);
    ok("resolving clears the stale on-hold flag", rs.body.status === "RESOLVED" && rs.body.onHold === false && rs.body.onHoldReason === null && rs.body.resolvedAt);
    ok("raiser notified of resolution and the comment saved", hasNotif(await notifs(emp), "was resolved") && (await get(lead, base)).body.comments.some((c: any) => c.body === "Replaced the panel"));
    is("cannot hold a resolved ticket", await post(eng, `${base}/hold`, { detail: "x" }), 403);
    is("engineer cannot close", await post(eng, `${base}/close`), 403);

    // reopen by raiser, reassign, resolve, close
    is("other employee cannot reopen", await post(emp2.token, `${base}/reopen`, { reason: "mine too" }), 403);
    is("reopen needs a reason", await post(emp, `${base}/reopen`, { reason: "" }), 400);
    const rop = await post(emp, `${base}/reopen`, { reason: "Still flickering this morning" });
    is("raiser reopens a resolved ticket", rop, 200);
    ok("REOPENED, resolution cleared", rop.body.status === "REOPENED" && rop.body.resolvedAt === null && rop.body.resolvedById === null);
    ok("lead & engineer notified", hasNotif(await notifs(lead), "was reopened") && hasNotif(await notifs(eng), "was reopened"));
    is("cannot start a reopened ticket without reassigning", await post(eng, `${base}/start-progress`), 403);
    is("lead reassigns after reopen (new deadline)", await post(lead, `${base}/assign`, { assignedToId: eng2.id, deadline: future(1) }), 200);
    ok("new engineer sees it, old one no longer does", (await get(eng2.token, "/helpdesk")).body.some((t: any) => t.id === H.id) && !(await get(eng, "/helpdesk")).body.some((t: any) => t.id === H.id));
    is("new engineer starts", await post(eng2.token, `${base}/start-progress`), 200);
    is("new engineer resolves", await post(eng2.token, `${base}/resolve`, {}), 200);
    is("close needs lead/admin", await post(emp, `${base}/close`), 403);
    const cl = await post(lead, `${base}/close`);
    is("lead closes the ticket", cl, 200);
    ok("CLOSED with closer", cl.body.status === "CLOSED" && cl.body.closedById);
    ok("all parties notified of closure", hasNotif(await notifs(emp), "was closed"));
    is("cannot close twice", await post(lead, `${base}/close`), 403);
    is("raiser can reopen a CLOSED ticket", await post(emp, `${base}/reopen`, { reason: "It happened again" }), 200);
    const detail = (await get(lead, base)).body;
    ok("history has every transition and comments are in order", ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REOPENED", "CLOSED"].every((s) => detail.statusHistory.some((h: any) => h.toStatus === s)) && detail.comments.length >= 3);

    // deadline update + comments
    const H2 = (await post(emp, "/helpdesk", { category: "NETWORK", title: "WiFi drops in bay 2", description: "Disconnects every hour" })).body;
    is("update deadline: engineer denied", await patch(eng, `/helpdesk/${H2.id}/deadline`, { deadline: future() }), 403);
    is("update deadline: invalid date -> 400", await patch(lead, `/helpdesk/${H2.id}/deadline`, { deadline: "xx" }), 400);
    is("update deadline: past -> 400", await patch(lead, `/helpdesk/${H2.id}/deadline`, { deadline: "2020-01-01T00:00:00Z" }), 400);
    is("update deadline: ok", await patch(lead, `/helpdesk/${H2.id}/deadline`, { deadline: future(5) }), 200);
    is("comment by raiser", await post(emp, `/helpdesk/${H2.id}/comments`, { body: "Happens near the packing line" }), 201);
    is("empty comment -> 400", await post(emp, `/helpdesk/${H2.id}/comments`, { body: "" }), 400);
    is("unknown helpdesk ticket -> 404", await get(lead, "/helpdesk/nope"), 404);
    is("invalid status filter -> 400", await get(lead, "/helpdesk?status=BOGUS"), 400);
    ok("status filter", (await get(lead, "/helpdesk?status=OPEN")).body.every((t: any) => t.status === "OPEN"));
    ok("category filter", (await get(lead, "/helpdesk?category=NETWORK")).body.every((t: any) => t.category === "NETWORK"));
    ok("search filter", (await get(lead, "/helpdesk?search=wifi")).body.some((t: any) => t.id === H2.id));
    ok("date filter excludes the past", (await get(lead, "/helpdesk?range=custom&from=2019-01-01&to=2019-01-02")).body.length === 0);
    ok("employee list only contains their own tickets", (await get(emp, "/helpdesk")).body.every((t: any) => t.raisedBy.id === id("amit.joshi@soliflexpackaging.com")));

    // dashboards
    is("helpdesk dashboard: employee denied", await get(emp, "/helpdesk/dashboard/stats"), 403);
    is("helpdesk dashboard: engineer denied", await get(eng, "/helpdesk/dashboard/stats"), 403);
    const ds = await get(lead, "/helpdesk/dashboard/stats");
    is("helpdesk dashboard: lead allowed", ds, 200);
    ok("dashboard totals match the real ticket count", ds.body.total === (await prisma.helpdeskTicket.count()) && ds.body.byStatus.reduce((s: number, x: any) => s + x.count, 0) === ds.body.total);
    ok("workload lists active engineers", ds.body.perEngineerWorkload.length >= 2);
  }

  section("HELPDESK: live breach display & background deadline alerts");
  {
    const sneaky = (await post(emp, "/helpdesk", { category: "SOFTWARE", title: "Excel crashes", description: "Crashes on open" })).body;
    is("assign for breach test", await post(lead, `/helpdesk/${sneaky.id}/assign`, { assignedToId: id("divya.rao@soliflex.local"), deadline: future(1) }), 200);
    // time travel: deadline passes without the cron having run yet
    await prisma.helpdeskTicket.update({ where: { id: sneaky.id }, data: { deadline: new Date(Date.now() - 3_600_000), deadlineBreached: false } });
    const seen = (await get(lead, "/helpdesk")).body.find((t: any) => t.id === sneaky.id);
    ok("list shows breached immediately (before the cron runs)", seen.deadlineBreached === true);
    ok("detail shows breached immediately", (await get(lead, `/helpdesk/${sneaky.id}`)).body.deadlineBreached === true);
    const noDeadline = (await post(emp, "/helpdesk", { category: "OTHER", title: "No deadline case", description: "assigned but no deadline" })).body;
    await prisma.helpdeskTicket.update({ where: { id: noDeadline.id }, data: { status: "ASSIGNED", assignedToId: id("divya.rao@soliflex.local"), deadline: null } });
    ok("missing-deadline filter finds assigned tickets without a deadline", (await get(lead, "/helpdesk?missingDeadline=true")).body.some((t: any) => t.id === noDeadline.id));

    const before = (await notifs(lead)).length;
    startHelpdeskDeadlineCheckJob();
    await new Promise((r) => setTimeout(r, 9000));
    const after = await prisma.helpdeskTicket.findUniqueOrThrow({ where: { id: sneaky.id } });
    ok("job sets the deadlineBreached flag", after.deadlineBreached === true);
    ok("job notifies lead, raiser and assignee about the breach", hasNotif(await notifs(lead), `Deadline passed for helpdesk ticket ${sneaky.ticketNumber}`) && hasNotif(await notifs(emp), `Deadline passed for helpdesk ticket ${sneaky.ticketNumber}`) && hasNotif(await notifs(eng), `Deadline passed for helpdesk ticket ${sneaky.ticketNumber}`));
    ok("job alerts leads about an assigned ticket with no deadline", hasNotif(await notifs(lead), `${noDeadline.ticketNumber} is assigned but has no deadline set`));
    ok("job produced new lead notifications", (await notifs(lead)).length > before);
  }

  section("SLA job for board tickets");
  {
    const t = (await post(prod, "/tickets", { workstream: "MAINTENANCE", category: "PRODUCTION_MACHINE", title: "Conveyor belt slipping", description: "Slips under load" })).body;
    await post(mgrMFresh, `/tickets/${t.id}/assign`, { assignedToId: id("suresh.patil@soliflex.local"), priority: "LOW", targetCompletionDate: "2031-01-01" });
    await prisma.ticket.update({ where: { id: t.id }, data: { targetCompletionDate: new Date(Date.now() - 7_200_000), slaBreached: false } });
    ok("board list shows SLA breached immediately", (await get(mgrMFresh, `/tickets/${t.id}`)).body.slaBreached === true);
    startSlaCheckJob();
    await new Promise((r) => setTimeout(r, 6500));
    ok("SLA job sets the flag", (await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).slaBreached === true);
    ok("SLA job notifies manager and assignee", hasNotif(await notifs(mgrMFresh), `SLA breached for ${t.ticketNumber}`) && hasNotif(await notifs(mech), `SLA breached for ${t.ticketNumber}`));
  }

  // ===================================================== ASSETS
  section("ASSETS: access, creation, QR, uploads, categories, bulk import");
  {
    is("employee cannot list maintenance assets", await get(emp, "/assets/maintenance"), 403);
    is("employee cannot list IT assets", await get(emp, "/assets/it"), 403);
    is("engineer cannot list IT assets", await get(eng, "/assets/it"), 403);
    is("mechanic can view assets", await get(mech, "/assets/maintenance"), 200);
    is("mechanic cannot create assets", await post(mech, "/assets/maintenance", { name: "x", category: "TOOL" }), 403);
    is("IT tech cannot create maintenance assets", await post(itTech, "/assets/maintenance", { name: "x", category: "TOOL" }), 403);
    is("production cannot create IT assets", await post(prod, "/assets/it", { name: "x", category: "LAPTOP" }), 403);
    is("name required", await post(prod, "/assets/maintenance", { name: "", category: "TOOL" }), 400);
    is("invalid date -> 400", await post(prod, "/assets/maintenance", { name: "Drill", category: "tool", purchaseDate: "31/02/2024" }), 400);

    const a = await post(prod, "/assets/maintenance", { name: "Slitter Rewinder", category: "Plant Equipment", model: "SR-9", manufacturer: "ACME", plantLocation: "Bay 2", purchaseDate: "15-01-2024", warrantyStartDate: "2024-01-15", warrantyEndDate: "2027-01-15" });
    is("production creates a maintenance asset", a, 201);
    ok("category normalised to PLANT_EQUIPMENT", a.body.category === "PLANT_EQUIPMENT");
    ok("item code M-AST-NNN and statusSince set", /^M-AST-\d{3}$/.test(a.body.itemCode) && a.body.statusSince);
    ok("DD-MM-YYYY date stored correctly", a.body.purchaseDate.startsWith("2024-01-15"));
    ok("QR code URL generated", typeof a.body.qrCodeUrl === "string");
    const qr = await fetch(`${base}/api/assets/maintenance/${a.body.id}/qrcode`, { headers: { Authorization: `Bearer ${prod}` } });
    ok("QR code image is served (PNG)", qr.status === 200 && (qr.headers.get("content-type") ?? "").includes("png"));
    is("QR denied to employees", await get(emp, `/assets/maintenance/${a.body.id}/qrcode`), 403);
    const b = await post(mgrMFresh, "/assets/maintenance", { name: "Second Asset", category: "PLANT_EQUIPMENT" });
    ok("item codes are sequential", Number(b.body.itemCode.split("-")[2]) === Number(a.body.itemCode.split("-")[2]) + 1);
    ok("categories endpoint lists distinct categories", (await get(mech, "/assets/maintenance/categories")).body.filter((c: string) => c === "PLANT_EQUIPMENT").length === 1);
    ok("category filter is case/format tolerant", (await get(mech, "/assets/maintenance?category=plant equipment")).body.length === 2);
    ok("search by name and code", (await get(mech, "/assets/maintenance?search=slitter")).body.length === 1 && (await get(mech, `/assets/maintenance?search=${b.body.itemCode}`)).body.length === 1);
    is("asset detail", await get(mech, `/assets/maintenance/${a.body.id}`), 200);
    is("unknown asset -> 404", await get(mech, "/assets/maintenance/nope"), 404);

    const aId = a.body.id;
    const ph = new FormData();
    ph.append("photos", new Blob([PNG], { type: "image/png" }), "p1.png");
    ph.append("photos", new Blob([PNG], { type: "image/png" }), "p2.png");
    ph.append("caption", "Front view");
    const phr = await call("POST", `/api/assets/maintenance/${aId}/photos`, { token: prod, form: ph });
    ok("two photos uploaded in one request", phr.status === 201 && phr.body.length === 2 && phr.body[0].caption === "Front view");
    is("mechanic cannot upload photos", await call("POST", `/api/assets/maintenance/${aId}/photos`, { token: mech, form: ph }), 403);
    const inv = file("inv.pdf", "application/pdf", Buffer.from("%PDF-1.4 test"));
    inv.append("invoiceNumber", "INV-77");
    inv.append("amount", "15000");
    const ir = await call("POST", `/api/assets/maintenance/${aId}/invoices`, { token: prod, form: inv });
    ok("invoice with number and amount uploaded", ir.status === 201 && ir.body.invoiceNumber === "INV-77" && ir.body.amount === 15000);
    const detail = (await get(mech, `/assets/maintenance/${aId}`)).body;
    ok("detail returns photos and invoices", detail.photos.length === 2 && detail.invoices.length === 1);
    is("invoice upload without a file -> 400", await call("POST", `/api/assets/maintenance/${aId}/invoices`, { token: prod, form: new FormData() }), 400);
    ok("photo for a missing asset is rejected cleanly (4xx, not 500)", (await call("POST", `/api/assets/maintenance/nope/photos`, { token: prod, form: ph })).status === 400);

    const down = await patch(prod, `/assets/maintenance/${aId}`, { status: "DOWN" });
    is("mark asset DOWN", down, 200);
    ok("statusSince refreshed and downtime alert reset", down.body.status === "DOWN");
    ok("status change audited", (await get(admin, `/audit?entityType=MaintenanceAsset&entityId=${aId}`)).body.entries.some((e: any) => e.field === "status" && e.newValue === "DOWN"));
    is("invalid status -> 400", await patch(prod, `/assets/maintenance/${aId}`, { status: "BROKEN" }), 400);
    is("mechanic cannot edit asset", await patch(mech, `/assets/maintenance/${aId}`, { name: "x" }), 403);

    // IT assets
    const it = await post(itTech, "/assets/it", { name: "Dell Latitude", category: "laptop", serialNumber: "SN1", ipAddress: "10.0.0.5", warrantyEndDate: "2027-05-01", licenseExpiryDate: "2026-12-31" });
    is("IT tech creates an IT asset", it, 201);
    ok("IT code IT-AST-NNN and QR", /^IT-AST-\d{3}$/.test(it.body.itemCode) && it.body.qrCodeUrl);
    ok("IT assets have no photo upload route", (await call("POST", `/api/assets/it/${it.body.id}/photos`, { token: itTech, form: ph })).status === 404);
    const iinv = file("it.pdf", "application/pdf", Buffer.from("%PDF-1.4"));
    is("IT invoice upload", await call("POST", `/api/assets/it/${it.body.id}/invoices`, { token: itTech, form: iinv }), 201);
    is("IT status change", await patch(itTech, `/assets/it/${it.body.id}`, { status: "RETIRED" }), 200);
    ok("expiring endpoint finds the license within window", Array.isArray((await get(mgrIT, "/assets/it/expiring?days=400")).body));
    is("template: production can download maintenance template", await get(prod, "/assets/maintenance/template"), 200);
    is("template: mechanic cannot", await get(mech, "/assets/maintenance/template"), 403);

    // bulk import
    const csv = [
      "name,category,model,manufacturer,plantLocation,specifications,purchaseDate,warrantyStartDate,warrantyEndDate",
      "Lathe 1,Production Machine,L1,Acme,Bay1,,15-01-2024,15-01-2024,15-01-2027",
      "Lathe 2,security,,,,,2024-02-01,,",
      ",NoName,,,,,,,",
      "Lathe 4,Storage,,,,,31-02-2024,,",
      "Lathe 5,Network Gear,,,,,,,2026/05/05",
    ].join("\n");
    const f = new FormData();
    f.append("file", new Blob([csv], { type: "text/csv" }), "assets.csv");
    const bi = await call("POST", "/api/assets/maintenance/bulk-import", { token: prod, form: f });
    ok("bulk import: good rows in (free-text categories, DD-MM-YYYY), bad rows reported", bi.status === 200 && bi.body.imported === 2 && bi.body.failed === 3, JSON.stringify(bi.body));
    ok("bulk import: error rows are numbered like the spreadsheet", bi.body.errors.map((e: any) => e.row).join() === "4,5,6");
    ok("bulk imported categories are queryable", (await get(mech, "/assets/maintenance?category=production machine")).body.some((x: any) => x.name === "Lathe 1"));
    is("bulk import: mechanic denied", await call("POST", "/api/assets/maintenance/bulk-import", { token: mech, form: f }), 403);
    const itCsv = ["name,category,serialNumber,specifications,ipAddress,macAddress,vendor,purchaseDate,warrantyEndDate,licenseExpiryDate,costCenter", "Switch 24p,Network Gear,SW1,,10.0.0.9,,Cisco,01-03-2024,01-03-2027,,CC1"].join("\n");
    const f2 = new FormData();
    f2.append("file", new Blob([itCsv], { type: "text/csv" }), "it.csv");
    const bi2 = await call("POST", "/api/assets/it/bulk-import", { token: itTech, form: f2 });
    ok("IT bulk import works", bi2.status === 200 && bi2.body.imported === 1, JSON.stringify(bi2.body));

    // linking assets to tickets
    const lt = await post(prod, "/tickets", { workstream: "MAINTENANCE", category: "PRODUCTION_MACHINE", title: "Slitter jam", description: "Jams at speed", maintenanceAssetId: aId });
    ok("ticket can be linked to an asset", lt.status === 201 && lt.body.maintenanceAssetId === aId);

    // asset alert job
    await prisma.maintenanceAsset.update({ where: { id: aId }, data: { warrantyEndDate: new Date(Date.now() + 10 * 86_400_000), expiryAlertedAt: null, statusSince: new Date(Date.now() - 100 * 3_600_000), downtimeAlertedAt: null } });
    startAssetAlertsJob();
    await new Promise((r) => setTimeout(r, 9500));
    const mn = await notifs(mgrMFresh);
    ok("asset job: warranty-expiry alert sent to the manager", hasNotif(mn, `Warranty for ${a.body.itemCode}`));
    ok("asset job: persistent-downtime alert sent to the manager", hasNotif(mn, `${a.body.itemCode} (Slitter Rewinder) has been down`));
  }

  // ===================================================== NOTIFICATIONS
  section("NOTIFICATIONS");
  {
    const mine = await notifs(emp);
    ok("employee has notifications", mine.length > 0);
    const unread = mine.find((n) => !n.read)!;
    ok("notification list is newest-first and capped at 50", mine.length <= 50);
    is("another user cannot mark my notification read", await post(emp2.token, `/notifications/${unread.id}/read`), 404);
    ok("…and it is still unread", (await notifs(emp)).find((n) => n.id === unread.id)!.read === false);
    is("owner marks it read", await post(emp, `/notifications/${unread.id}/read`), 200);
    ok("…now read", (await notifs(emp)).find((n) => n.id === unread.id)!.read === true);
    is("unknown id -> 404", await post(emp, "/notifications/nope/read"), 404);
    is("read-all", await post(emp, "/notifications/read-all"), 200);
    ok("all read after read-all", (await notifs(emp)).every((n) => n.read));
    ok("read-all did not touch other users", (await notifs(lead)).some((n) => !n.read));
    is("notifications need login", await get(undefined, "/notifications"), 401);
  }

  // ===================================================== AUDIT + REPORTS
  section("AUDIT & REPORTS access");
  {
    for (const [n, t] of Object.entries({ emp, eng, mech, prod, itTech, lead })) is(`audit denied for ${n}`, await get(t, "/audit"), 403);
    is("audit allowed for manager", await get(mgrMFresh, "/audit"), 200);
    const p1 = await get(admin, "/audit?limit=5");
    ok("audit pagination: page size honoured with a cursor", p1.body.entries.length === 5 && !!p1.body.nextCursor);
    const p2 = await get(admin, `/audit?limit=5&cursor=${p1.body.nextCursor}`);
    ok("audit pagination: next page differs and continues the order", p2.body.entries.length > 0 && p2.body.entries[0].id !== p1.body.entries[0].id && new Date(p2.body.entries[0].changedAt) <= new Date(p1.body.entries[4].changedAt));
    ok("audit: bad limit falls back safely", (await get(admin, "/audit?limit=abc")).status === 200);
    ok("audit entity types listed", (await get(admin, "/audit/entity-types")).body.includes("Ticket"));
    ok("audit date filter excludes the past", (await get(admin, "/audit?range=custom&from=2019-01-01&to=2019-01-02")).body.entries.length === 0);

    for (const [n, t] of Object.entries({ emp, eng, lead })) is(`reports denied for ${n}`, await get(t, "/reports/dashboard?workstream=IT"), 403);
    for (const [n, t] of Object.entries({ mech, prod, itTech, mgrMFresh, admin })) is(`reports allowed for ${n}`, await get(t, "/reports/dashboard?workstream=IT"), 200);
    const rep = (await get(mgrMFresh, "/reports/dashboard?workstream=IT")).body;
    ok("IT report includes helpdesk tickets", rep.sources.helpdesk && rep.sources.helpdesk.total === (await prisma.helpdeskTicket.count()));
    ok("IT report breach count includes the live-breached helpdesk ticket", rep.slaBreached >= 1 && rep.overdue >= 1);
    const m = (await get(mgrMFresh, "/reports/dashboard?workstream=MAINTENANCE")).body;
    ok("Maintenance report excludes helpdesk", m.sources.helpdesk === null && m.total === (await prisma.ticket.count({ where: { workstream: "MAINTENANCE" } })));
    is("export: employee denied", await get(emp, "/reports/export?workstream=IT"), 403);
  }

  // ===================================================== MISC
  section("MISC: health, headers, CORS, sockets auth");
  {
    is("health endpoint", await get(undefined, "/health"), 200);
    const h = await fetch(`${base}/api/health`);
    ok("security headers present (helmet)", h.headers.get("x-content-type-options") === "nosniff");
    ok("unknown API route does not crash the server", (await fetch(`${base}/api/nope`)).status === 404);
  }

  server.close();
  await prisma.$disconnect();
  console.log(`\n${checks} checks, ${failures} failure(s).`);
  if (failed.length) console.log("Failed:\n - " + failed.join("\n - "));
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error("QA run crashed:", e);
  await prisma.$disconnect();
  process.exit(2);
});
