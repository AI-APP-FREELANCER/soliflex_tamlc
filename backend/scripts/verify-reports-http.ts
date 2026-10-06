/**
 * Calls the real /api/reports/* routes over HTTP (cron jobs NOT started) and
 * prints what the web/mobile apps will actually receive. Read-only.
 * Run: npx tsx scripts/verify-reports-http.ts
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/lib/jwt";

const prisma = new PrismaClient();
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
};

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN", active: true } });
  const token = signAccessToken({ sub: admin.id, role: admin.role, workstream: admin.workstream, name: admin.name } as never);
  const server = http.createServer(createApp()).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/reports`;
  const get = (path: string) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });

  try {
    const noAuth = await fetch(`${base}/dashboard?workstream=IT`);
    check("unauthenticated request is rejected", noAuth.status === 401, `status ${noAuth.status}`);

    for (const ws of ["MAINTENANCE", "IT"]) {
      const res = await get(`/dashboard?workstream=${ws}`);
      const d = await res.json();
      check(`${ws} dashboard 200 + no-store`, res.status === 200 && res.headers.get("cache-control") === "no-store");
      console.log(
        `      ${ws}: total=${d.total} open=${d.open} closed=${d.closed} onHold=${d.onHold} breached=${d.slaBreached} overdueNow=${d.overdue} avgHrs=${d.avgResolutionHours}`
      );
      console.log(`      byStatus=${JSON.stringify(d.byStatus)}  sources.helpdesk=${JSON.stringify(d.sources.helpdesk)}`);
      const o = await (await get(`/overdue-tickets?workstream=${ws}`)).json();
      check(`${ws} overdue list matches overdue card`, o.length === d.overdue, `list=${o.length} card=${d.overdue}`);
      for (const t of o) console.log(`      overdue: ${t.source} ${t.ticketNumber} [${t.status}] due ${t.targetCompletionDate}`);
    }

    const bad = await get(`/dashboard?workstream=BOGUS`);
    check("invalid workstream value does not crash", bad.status === 200);

    const filtered = await (await get(`/dashboard?workstream=IT&range=custom&from=2019-01-01&to=2019-01-02`)).json();
    check("filter with no matching tickets returns zeros", filtered.total === 0 && filtered.slaBreached === 0 && filtered.overdue === 0);

    for (const ws of ["MAINTENANCE", "IT"]) {
      const res = await get(`/export?workstream=${ws}`);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
      const sheets = wb.worksheets.map((s) => `${s.name}(${s.rowCount - 1})`);
      check(`${ws} export is a valid xlsx`, res.status === 200 && wb.worksheets.length >= 1, sheets.join(", "));
      if (ws === "IT") check("IT export includes the Helpdesk sheet", !!wb.getWorksheet("Helpdesk Tickets"));
      if (ws === "MAINTENANCE") check("Maintenance export has no Helpdesk sheet", !wb.getWorksheet("Helpdesk Tickets"));
    }
    const ranged = new ExcelJS.Workbook();
    await ranged.xlsx.load(Buffer.from(await (await get(`/export?workstream=IT&range=custom&from=2019-01-01&to=2019-01-02`)).arrayBuffer()));
    check("export honours the date filter", ranged.worksheets.every((s) => s.rowCount <= 1));
  } finally {
    server.close();
    await prisma.$disconnect();
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll HTTP checks passed.");
  process.exit(failures ? 1 : 0);
}

main();
