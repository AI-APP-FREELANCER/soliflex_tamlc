import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

interface AuditEntry {
  entityType: string;
  entityId: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  action: string;
  changedById: string;
}

/** Insert-only audit trail. No update/delete is ever exposed for this table. */
export async function recordAudit(tx: Tx, entry: AuditEntry) {
  await tx.auditLog.create({
    data: {
      entityType: entry.entityType,
      entityId: entry.entityId,
      field: entry.field,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      action: entry.action,
      changedById: entry.changedById,
    },
  });
}

export async function recordFieldChanges(
  tx: Tx,
  entityType: string,
  entityId: string,
  changedById: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of fields) {
    const oldValue = before[field];
    const newValue = after[field];
    if (oldValue === newValue) continue;
    if (oldValue === undefined && newValue === undefined) continue;
    await recordAudit(tx, {
      entityType,
      entityId,
      field,
      oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
      newValue: newValue === null || newValue === undefined ? null : String(newValue),
      action: "UPDATE",
      changedById,
    });
  }
}
