/**
 * Go-live cleanup: removes the test data for
 *   1. Maintenance assets (+ photos, invoices, QR codes)
 *   2. IT tickets on the Board  (workstream = IT) incl. comments/history/attachments/costs
 *   3. IT Helpdesk tickets      incl. comments/history
 * and everything that only exists because of them (audit rows, notifications,
 * number sequences, uploaded files).
 *
 * NOT touched: users, sessions, IT assets, Maintenance-workstream board tickets,
 * and any audit/notification row about those.
 *
 * Usage (from backend/):
 *   npx tsx scripts/clear-test-data.ts             # dry run: counts only, changes nothing
 *   npx tsx scripts/clear-test-data.ts --execute   # backs up to backend/backups/, then deletes
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

const SEQUENCE_KEYS = ["asset:MAINTENANCE", "ticket:IT", "helpdesk-ticket"];

async function main() {
  const dbHost = new URL(process.env.DATABASE_URL!).host;
  console.log(`Database host: ${dbHost}`);
  console.log(execute ? "MODE: EXECUTE (will delete)\n" : "MODE: DRY RUN (nothing will be changed)\n");

  const assets = await prisma.maintenanceAsset.findMany({ include: { photos: true, invoices: true } });
  const itTickets = await prisma.ticket.findMany({
    where: { workstream: "IT" },
    include: { comments: true, attachments: true, costEntries: true, statusHistory: true },
  });
  const helpdesk = await prisma.helpdeskTicket.findMany({ include: { comments: true, statusHistory: true } });

  const itTicketIds = itTickets.map((t) => t.id);

  const notifWhere = {
    OR: [
      { link: { startsWith: "/helpdesk/" } },
      { link: { startsWith: "/assets/maintenance/" } },
      ...itTicketIds.map((id) => ({ link: `/tickets/${id}` })),
    ],
  };
  const auditWhere = {
    OR: [
      { entityType: "MaintenanceAsset" },
      { entityType: "HelpdeskTicket" },
      { entityType: "Ticket", entityId: { in: itTicketIds } },
    ],
  };

  const notifications = await prisma.notification.findMany({ where: notifWhere });
  const auditRows = await prisma.auditLog.findMany({ where: auditWhere });
  const sequences = await prisma.sequenceCounter.findMany({ where: { key: { in: SEQUENCE_KEYS } } });

  // Files on disk that belong only to the rows being deleted.
  const fileNames = new Set<string>();
  const addFile = (url?: string | null) => url && fileNames.add(path.basename(url));
  assets.forEach((a) => {
    addFile(a.qrCodeUrl);
    a.photos.forEach((p) => addFile(p.fileUrl));
    a.invoices.forEach((i) => addFile(i.fileUrl));
  });
  itTickets.forEach((t) => t.attachments.forEach((a) => addFile(a.fileUrl)));

  const remainingMaintTickets = await prisma.ticket.count({ where: { workstream: "MAINTENANCE" } });
  const remainingItAssets = await prisma.iTAsset.count();

  const rows = [
    ["Maintenance assets", assets.length],
    ["  photos", assets.reduce((n, a) => n + a.photos.length, 0)],
    ["  invoices", assets.reduce((n, a) => n + a.invoices.length, 0)],
    ["IT board tickets", itTickets.length],
    ["  comments", itTickets.reduce((n, t) => n + t.comments.length, 0)],
    ["  attachments", itTickets.reduce((n, t) => n + t.attachments.length, 0)],
    ["  cost entries", itTickets.reduce((n, t) => n + t.costEntries.length, 0)],
    ["  status history", itTickets.reduce((n, t) => n + t.statusHistory.length, 0)],
    ["Helpdesk tickets", helpdesk.length],
    ["  comments", helpdesk.reduce((n, t) => n + t.comments.length, 0)],
    ["  status history", helpdesk.reduce((n, t) => n + t.statusHistory.length, 0)],
    ["Notifications (about the above)", notifications.length],
    ["Audit log rows (about the above)", auditRows.length],
    ["Number counters reset", sequences.length],
    ["Uploaded files to remove", fileNames.size],
  ] as const;
  console.log("Will delete:");
  rows.forEach(([label, n]) => console.log(`  ${label.padEnd(36)} ${n}`));
  console.log("\nWill be LEFT UNTOUCHED:");
  console.log(`  ${"Maintenance board tickets".padEnd(36)} ${remainingMaintTickets}`);
  console.log(`  ${"IT assets".padEnd(36)} ${remainingItAssets}`);
  console.log(`  ${"Users".padEnd(36)} ${await prisma.user.count()}`);

  if (!execute) {
    console.log("\nDry run only. Re-run with --execute to apply.");
    return;
  }

  const backupDir = path.resolve("backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ assets, itTickets, helpdesk, notifications, auditRows, sequences }, null, 2));
  console.log(`\nBackup written: ${backupFile}`);

  // Child rows cascade from their parent (see schema onDelete: Cascade).
  const result = await prisma.$transaction(async (tx) => {
    const a = await tx.maintenanceAsset.deleteMany({});
    const t = await tx.ticket.deleteMany({ where: { workstream: "IT" } });
    const h = await tx.helpdeskTicket.deleteMany({});
    const n = await tx.notification.deleteMany({ where: notifWhere });
    const l = await tx.auditLog.deleteMany({ where: auditWhere });
    const s = await tx.sequenceCounter.deleteMany({ where: { key: { in: SEQUENCE_KEYS } } });
    return { assets: a.count, itTickets: t.count, helpdesk: h.count, notifications: n.count, audit: l.count, sequences: s.count };
  }, { timeout: 60_000 });
  console.log("Deleted:", result);

  let removed = 0;
  for (const name of fileNames) {
    const p = path.join(uploadDir, name);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      removed++;
    }
  }
  console.log(`Removed ${removed} uploaded file(s) from ${uploadDir}`);
  console.log("\nDone. Numbering restarts at M-AST-001 / IT-1001 / HD-1001.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
