/**
 * Go-live cleanup. Removes ALL operational data, keeps users.
 *
 * Deleted:
 *   - Maintenance assets (+ photos, invoices, QR codes)
 *   - IT assets (+ invoices, QR codes)
 *   - All Board tickets, Maintenance and IT (+ comments, status history, attachments, cost entries)
 *   - All IT Helpdesk tickets (+ comments, status history)
 *   - All notifications
 *   - Audit log rows about assets and tickets
 *   - Number counters (numbering restarts)
 *   - Every file in the uploads folder (photos, invoices, attachments, QR codes)
 *
 * Kept as they are: users (incl. Admin), their passwords/sessions, and the
 * audit rows about user accounts.
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

// Everything except user-account audit rows.
const auditWhere = { entityType: { not: "User" } };

function uploadedFiles(): string[] {
  if (!fs.existsSync(uploadDir)) return [];
  return fs
    .readdirSync(uploadDir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => e.name);
}

async function main() {
  console.log(`Database host: ${new URL(process.env.DATABASE_URL!).host}`);
  console.log(`Uploads folder: ${uploadDir}`);
  console.log(execute ? "MODE: EXECUTE (will delete)\n" : "MODE: DRY RUN (nothing will be changed)\n");

  const maintAssets = await prisma.maintenanceAsset.findMany({ include: { photos: true, invoices: true } });
  const itAssets = await prisma.iTAsset.findMany({ include: { invoices: true } });
  const tickets = await prisma.ticket.findMany({
    include: { comments: true, attachments: true, costEntries: true, statusHistory: true },
  });
  const helpdesk = await prisma.helpdeskTicket.findMany({ include: { comments: true, statusHistory: true } });
  const notifications = await prisma.notification.findMany();
  const auditRows = await prisma.auditLog.findMany({ where: auditWhere });
  const sequences = await prisma.sequenceCounter.findMany();
  const files = uploadedFiles();

  const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((n, x) => n + f(x), 0);
  const rows: [string, number][] = [
    ["Maintenance assets", maintAssets.length],
    ["  photos", sum(maintAssets, (a) => a.photos.length)],
    ["  invoices", sum(maintAssets, (a) => a.invoices.length)],
    ["IT assets", itAssets.length],
    ["  invoices", sum(itAssets, (a) => a.invoices.length)],
    ["Board tickets (Maintenance + IT)", tickets.length],
    ["  comments", sum(tickets, (t) => t.comments.length)],
    ["  attachments", sum(tickets, (t) => t.attachments.length)],
    ["  cost entries", sum(tickets, (t) => t.costEntries.length)],
    ["  status history", sum(tickets, (t) => t.statusHistory.length)],
    ["Helpdesk tickets", helpdesk.length],
    ["  comments", sum(helpdesk, (t) => t.comments.length)],
    ["  status history", sum(helpdesk, (t) => t.statusHistory.length)],
    ["Notifications", notifications.length],
    ["Audit log rows (assets/tickets)", auditRows.length],
    ["Number counters reset", sequences.length],
    ["Files in uploads folder", files.length],
  ];
  console.log("Will delete:");
  rows.forEach(([label, n]) => console.log(`  ${label.padEnd(36)} ${n}`));

  const users = await prisma.user.findMany({ select: { email: true, role: true, active: true }, orderBy: { email: "asc" } });
  console.log(`\nWill be KEPT: ${users.length} users, their sessions, and ${await prisma.auditLog.count({ where: { entityType: "User" } })} user-account audit rows`);
  users.forEach((u) => console.log(`  ${u.email.padEnd(40)} ${u.role}${u.active ? "" : " (inactive)"}`));

  if (!execute) {
    console.log("\nDry run only. Re-run with --execute to apply.");
    return;
  }

  const backupDir = path.resolve("backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ maintAssets, itAssets, tickets, helpdesk, notifications, auditRows, sequences, files }, null, 2)
  );
  console.log(`\nBackup (database rows) written: ${backupFile}`);
  console.log("Note: uploaded files are not included in that backup and cannot be restored once deleted.");

  // Child rows cascade from their parent (see schema onDelete: Cascade).
  const result = await prisma.$transaction(
    async (tx) => ({
      maintAssets: (await tx.maintenanceAsset.deleteMany({})).count,
      itAssets: (await tx.iTAsset.deleteMany({})).count,
      tickets: (await tx.ticket.deleteMany({})).count,
      helpdesk: (await tx.helpdeskTicket.deleteMany({})).count,
      notifications: (await tx.notification.deleteMany({})).count,
      audit: (await tx.auditLog.deleteMany({ where: auditWhere })).count,
      sequences: (await tx.sequenceCounter.deleteMany({})).count,
    }),
    { timeout: 60_000 }
  );
  console.log("Deleted:", result);

  let removed = 0;
  for (const name of files) {
    fs.unlinkSync(path.join(uploadDir, name));
    removed++;
  }
  console.log(`Removed ${removed} file(s) from ${uploadDir}`);
  console.log("\nDone. Numbering restarts at M-AST-001 / IT-AST-001 / MAIN-1001 / IT-1001 / HD-1001.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
