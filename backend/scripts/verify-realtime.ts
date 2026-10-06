/**
 * End-to-end check of live updates. Starts the real API + socket server (cron
 * jobs NOT started), connects clients like web (polling->websocket) and mobile
 * (websocket-only, no Origin header), then makes a real no-op write and
 * measures how long until each client is told. Writes nothing (same-value update).
 * Run: npx tsx scripts/verify-realtime.ts
 */
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";
import { initSockets } from "../src/sockets";
import { signAccessToken } from "../src/lib/jwt";
import { deadlinesCrossed } from "../src/jobs/deadline-ticker.job";

const requireFromFrontend = createRequire(path.resolve(process.cwd(), "../frontend/package.json"));
const { io } = requireFromFrontend("socket.io-client") as typeof import("socket.io-client");

const prisma = new PrismaClient();
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN", active: true } });
  const token = signAccessToken({ sub: admin.id, role: admin.role, workstream: admin.workstream, name: admin.name } as never);
  const server = http.createServer(createApp());
  initSockets(server);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const connect = (transports: string[], authToken: string | null) =>
    new Promise<ReturnType<typeof io>>((resolve, reject) => {
      const s = io(base, { transports, auth: { token: authToken }, reconnection: false });
      s.on("connect", () => resolve(s));
      s.on("connect_error", (e) => reject(e));
    });

  const web = await connect(["polling", "websocket"], token);
  const mobile = await connect(["websocket"], token);
  check("web-style client connects", web.connected);
  check("mobile-style client (websocket only, no Origin) connects", mobile.connected);
  await connect(["websocket"], null).then(
    () => check("socket without a token is rejected", false),
    (e) => check("socket without a token is rejected", /Not authenticated/.test(String(e.message)))
  );
  await connect(["websocket"], "garbage").then(
    () => check("socket with an invalid token is rejected", false),
    (e) => check("socket with an invalid token is rejected", /Invalid session/.test(String(e.message)))
  );

  const events: Record<string, { at: number; scopes: string[] }[]> = { web: [], mobile: [] };
  web.on("data-changed", (p) => events.web.push({ at: Date.now(), scopes: p.scopes }));
  mobile.on("data-changed", (p) => events.mobile.push({ at: Date.now(), scopes: p.scopes }));

  const ticket = await prisma.ticket.findFirstOrThrow({ where: { priority: { not: null } } });
  const auditBefore = await prisma.auditLog.count();
  const patch = (priority: string | null) =>
    fetch(`${base}/api/tickets/${ticket.id}/priority`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });

  // 1) failed write -> no signal
  const bad = await patch(null);
  await sleep(500);
  check("rejected write (4xx) sends no signal", bad.status >= 400 && events.web.length === 0 && events.mobile.length === 0, `status ${bad.status}`);

  // 2) successful write -> both clients told, fast
  const t0 = Date.now();
  const ok = await patch(ticket.priority);
  const tResponse = Date.now();
  await sleep(600);
  check("successful write returns 200", ok.status === 200, `status ${ok.status}`);
  check("web client received data-changed", events.web.length === 1, JSON.stringify(events.web[0]?.scopes));
  check("mobile client received data-changed", events.mobile.length === 1, JSON.stringify(events.mobile[0]?.scopes));
  if (events.web[0]) console.log(`      latency: request->response ${tResponse - t0}ms, response->web ${events.web[0].at - tResponse}ms, response->mobile ${events.mobile[0]?.at - tResponse}ms`);
  check("signal arrives well under 1 second after the change", !!events.web[0] && events.web[0].at - tResponse < 1000);
  check("scope is labelled 'tickets'", events.web[0]?.scopes.includes("tickets") === true);

  // 3) burst of writes is coalesced
  events.web.length = 0;
  await Promise.all([patch(ticket.priority), patch(ticket.priority), patch(ticket.priority)]);
  await sleep(600);
  check("a burst of 3 writes is coalesced into 1 signal", events.web.length === 1, `got ${events.web.length}`);

  check("test wrote nothing (audit log unchanged)", (await prisma.auditLog.count()) === auditBefore);

  // 4) time-based: ticker detects a deadline crossing
  const hd = await prisma.helpdeskTicket.findFirstOrThrow({ where: { deadline: { not: null }, status: { notIn: ["CLOSED", "RESOLVED"] } } });
  const d = hd.deadline!.getTime();
  check("ticker fires when an open ticket's deadline falls in the window", await deadlinesCrossed(new Date(d - 5000), new Date(d + 5000)));
  check("ticker stays quiet when nothing crossed", !(await deadlinesCrossed(new Date(Date.UTC(2015, 0, 1)), new Date(Date.UTC(2015, 0, 2)))));

  web.close();
  mobile.close();
  server.close();
  await prisma.$disconnect();
  console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll real-time checks passed.");
  process.exit(failures ? 1 : 0);
}

main();
