/**
 * Differential check for the Reports module (read-only).
 *
 * Re-computes every dashboard / overdue figure in plain JS from raw rows
 * (no shared query code) and compares it with the live report functions for
 * each workstream x date-range combination.
 *
 * Run: npx tsx scripts/verify-reports.ts
 */
import { PrismaClient } from "@prisma/client";
import { resolveDateRange, type DateRange } from "../src/lib/date-range";
import { buildDashboardReport, buildOverdueReport } from "../src/modules/reports/reports.service";

const prisma = new PrismaClient();
let failures = 0;
let checks = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`  FAIL ${label}\n    expected ${e}\n    actual   ${a}`);
  }
}

const inRange = (d: Date, r?: DateRange) => !r || ((!r.gte || d >= r.gte) && (!r.lte || d <= r.lte));
const sortCounts = (m: Map<string, number>) => [...m.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => a.k.localeCompare(b.k));

const TEST_PREFIX = "ZZVERIFY";
const DAY = 86_400_000;

async function seedSynthetic() {
  const reporter = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN", active: true } });
  const ago = (days: number) => new Date(Date.now() - days * DAY);
  const ahead = (days: number) => new Date(Date.now() + days * DAY);
  let n = 0;
  const legacy = (o: Record<string, unknown>) =>
    prisma.ticket.create({
      data: {
        ticketNumber: `${TEST_PREFIX}-T${++n}`,
        category: "OTHER_MACHINE",
        title: "verify",
        description: "verify",
        reportedById: reporter.id,
        ...o,
      } as never,
    });
  const helpdesk = (o: Record<string, unknown>) =>
    prisma.helpdeskTicket.create({
      data: {
        ticketNumber: `${TEST_PREFIX}-H${++n}`,
        category: "OTHER",
        title: "verify",
        description: "verify",
        raisedById: reporter.id,
        ...o,
      } as never,
    });

  // Legacy: both workstreams, stale (flag false but overdue), future, closed w/ resolution time, on hold, varied ages.
  await legacy({ workstream: "MAINTENANCE", status: "IN_PROGRESS", targetCompletionDate: ago(2), slaBreached: false, priority: "HIGH", createdAt: ago(5) });
  await legacy({ workstream: "MAINTENANCE", status: "OPEN", targetCompletionDate: ahead(3), createdAt: ago(0.1) });
  await legacy({ workstream: "MAINTENANCE", status: "CLOSED", targetCompletionDate: ago(10), slaBreached: true, closedAt: ago(8), createdAt: ago(12), priority: "LOW", actualCost: 1500 });
  await legacy({ workstream: "MAINTENANCE", status: "FINAL_REVIEW", onHold: true, onHoldReason: "VENDOR", targetCompletionDate: ago(1), createdAt: ago(40), priority: "CRITICAL" });
  await legacy({ workstream: "IT", category: "LAPTOP", status: "ASSIGNED", targetCompletionDate: ago(3), slaBreached: false, createdAt: ago(20), priority: "MEDIUM" });
  await legacy({ workstream: "IT", category: "LAPTOP", status: "CLOSED", closedAt: ago(1), createdAt: ago(3), priority: "LOW" });
  await legacy({ workstream: "IT", category: "SERVER", status: "IN_PROGRESS", targetCompletionDate: ahead(1), createdAt: ago(0.05) });

  // Helpdesk: stale breach, flagged breach, resolved-after-breach, closed, open w/o deadline, on hold, reopened.
  await helpdesk({ status: "IN_PROGRESS", deadline: ago(1), deadlineBreached: false, priority: "HIGH", createdAt: ago(4) });
  await helpdesk({ status: "ASSIGNED", deadline: ago(6), deadlineBreached: true, priority: "CRITICAL", createdAt: ago(9) });
  await helpdesk({ status: "RESOLVED", deadline: ago(2), deadlineBreached: true, resolvedAt: ago(1), createdAt: ago(7) });
  await helpdesk({ status: "RESOLVED", deadline: ahead(2), deadlineBreached: false, resolvedAt: ago(0.5), createdAt: ago(2) });
  await helpdesk({ status: "CLOSED", deadline: ago(30), deadlineBreached: true, resolvedAt: ago(25), closedAt: ago(24), createdAt: ago(32) });
  await helpdesk({ status: "OPEN", createdAt: ago(0.02) });
  await helpdesk({ status: "REOPENED", onHold: true, deadline: ahead(5), createdAt: ago(15), priority: "MEDIUM" });
  await helpdesk({ status: "IN_PROGRESS", deadline: ago(0.01), deadlineBreached: false, createdAt: ago(60) });
}

async function cleanupSynthetic() {
  const [a, b] = await Promise.all([
    prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: TEST_PREFIX } } }),
    prisma.helpdeskTicket.deleteMany({ where: { ticketNumber: { startsWith: TEST_PREFIX } } }),
  ]);
  console.log(`Cleanup: removed ${a.count} synthetic legacy + ${b.count} synthetic helpdesk ticket(s).`);
}

async function main() {
  const seed = process.env.VERIFY_SEED === "1";
  if (seed) {
    await cleanupSynthetic();
    await seedSynthetic();
  }
  try {
    await runChecks();
  } finally {
    if (seed) await cleanupSynthetic();
  }
}

async function runChecks() {
  const now = new Date();
  const [allTickets, allHelpdesk] = await Promise.all([prisma.ticket.findMany(), prisma.helpdeskTicket.findMany()]);
  console.log(`Raw rows: ${allTickets.length} legacy, ${allHelpdesk.length} helpdesk. now=${now.toISOString()}\n`);

  const ranges: { name: string; query: { range?: string; from?: string; to?: string } }[] = [
    { name: "all time", query: {} },
    { name: "today", query: { range: "today" } },
    { name: "this_week", query: { range: "this_week" } },
    { name: "mtd", query: { range: "mtd" } },
    { name: "last_7_days", query: { range: "last_7_days" } },
    { name: "last_30_days", query: { range: "last_30_days" } },
    { name: "custom wide", query: { range: "custom", from: "2020-01-01", to: "2030-12-31" } },
    { name: "custom Sep 2026", query: { range: "custom", from: "2026-09-01", to: "2026-09-30" } },
    { name: "custom from only", query: { range: "custom", from: "2026-09-12" } },
    { name: "custom to only", query: { range: "custom", to: "2026-09-12" } },
    { name: "custom empty window", query: { range: "custom", from: "2019-01-01", to: "2019-01-02" } },
  ];

  for (const workstream of ["MAINTENANCE", "IT", undefined] as const) {
    for (const r of ranges) {
      const range = resolveDateRange(r.query);
      const tag = `[${workstream ?? "ALL"} | ${r.name}]`;

      const t = allTickets.filter((x) => (!workstream || x.workstream === workstream) && inRange(x.createdAt, range));
      const h = workstream === "MAINTENANCE" ? [] : allHelpdesk.filter((x) => inRange(x.createdAt, range));

      const tClosed = t.filter((x) => x.status === "CLOSED");
      const hClosed = h.filter((x) => x.status === "CLOSED");
      const tBreached = t.filter((x) => x.slaBreached || (x.status !== "CLOSED" && x.targetCompletionDate && x.targetCompletionDate < now));
      const tOverdue = t.filter((x) => x.status !== "CLOSED" && x.targetCompletionDate && x.targetCompletionDate < now);
      const fin = ["CLOSED", "RESOLVED"];
      const hBreached = h.filter((x) => x.deadlineBreached || (!fin.includes(x.status) && x.deadline && x.deadline < now));
      const hOverdue = h.filter((x) => !fin.includes(x.status) && x.deadline && x.deadline < now);

      const report = await buildDashboardReport(workstream, range, now);

      eq(`${tag} total`, report.total, t.length + h.length);
      eq(`${tag} closed`, report.closed, tClosed.length + hClosed.length);
      eq(`${tag} open = total - closed`, report.open, t.length + h.length - tClosed.length - hClosed.length);
      eq(`${tag} onHold`, report.onHold, t.filter((x) => x.onHold).length + h.filter((x) => x.onHold).length);
      eq(`${tag} slaBreached`, report.slaBreached, tBreached.length + hBreached.length);
      eq(`${tag} overdue`, report.overdue, tOverdue.length + hOverdue.length);
      eq(`${tag} sources.tickets.total`, report.sources.tickets.total, t.length);
      eq(`${tag} sources.helpdesk.total`, report.sources.helpdesk?.total ?? null, workstream === "MAINTENANCE" ? null : h.length);
      eq(`${tag} byStatus sums to total`, report.byStatus.reduce((s, x) => s + x.count, 0), t.length + h.length);
      eq(`${tag} byPriority sums to total`, report.byPriority.reduce((s, x) => s + x.count, 0), t.length + h.length);

      const statusMap = new Map<string, number>();
      for (const x of [...t, ...h]) statusMap.set(x.status, (statusMap.get(x.status) ?? 0) + 1);
      eq(`${tag} byStatus`, sortCounts(new Map(report.byStatus.map((s) => [s.status, s.count]))), sortCounts(statusMap));

      const prioMap = new Map<string, number>();
      for (const x of [...t, ...h]) prioMap.set(String(x.priority), (prioMap.get(String(x.priority)) ?? 0) + 1);
      eq(`${tag} byPriority`, sortCounts(new Map(report.byPriority.map((p) => [String(p.priority), p.count]))), sortCounts(prioMap));

      const durations: number[] = [
        ...tClosed.filter((x) => x.closedAt).map((x) => x.closedAt!.getTime() - x.createdAt.getTime()),
        ...h.filter((x) => fin.includes(x.status) && (x.resolvedAt ?? x.closedAt)).map((x) => (x.resolvedAt ?? x.closedAt)!.getTime() - x.createdAt.getTime()),
      ];
      const avg = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length / 3_600_000) * 10) / 10 : 0;
      eq(`${tag} avgResolutionHours`, report.avgResolutionHours, avg);

      const overdue = await buildOverdueReport(workstream, range, now);
      const expectedOverdue = [
        ...tOverdue.map((x) => `TICKET:${x.id}`),
        ...hOverdue.map((x) => `HELPDESK:${x.id}`),
      ].sort();
      eq(`${tag} overdue ids`, overdue.map((o) => `${o.source}:${o.id}`).sort(), expectedOverdue);
      eq(`${tag} overdue list == overdue stat`, overdue.length, report.overdue);
      eq(
        `${tag} overdue sorted by date`,
        overdue.map((o) => o.targetCompletionDate.getTime()),
        overdue.map((o) => o.targetCompletionDate.getTime()).sort((a, b) => a - b)
      );
    }
  }

  // Stale-flag scenarios (synthetic, verified against the same predicates the report uses).
  const staleLegacy = allTickets.filter((x) => !x.slaBreached && x.status !== "CLOSED" && x.targetCompletionDate && x.targetCompletionDate < now);
  const staleHelpdesk = allHelpdesk.filter((x) => !x.deadlineBreached && !["CLOSED", "RESOLVED"].includes(x.status) && x.deadline && x.deadline < now);
  console.log(`Tickets overdue but cron flag not yet set: legacy=${staleLegacy.length}, helpdesk=${staleHelpdesk.length} (these are now counted live)`);

  console.log(`\n${checks} checks, ${failures} failure(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failures > 0) process.exitCode = 1;
  });
