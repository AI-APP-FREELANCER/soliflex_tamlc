import { prisma } from "../../lib/prisma";

/**
 * Atomically increments a named counter inside the caller's transaction and
 * returns the new value. Used for ticket numbers (MAIN-1001 / IT-1001) and
 * asset item codes (M-AST-001 / IT-AST-001) so numbers never collide or repeat,
 * even under concurrent requests.
 */
export async function nextSequenceValue(tx: typeof prisma, key: string, start = 1000): Promise<number> {
  const counter = await tx.sequenceCounter.upsert({
    where: { key },
    create: { key, value: start + 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

export function formatTicketNumber(workstream: "MAINTENANCE" | "IT", value: number): string {
  const prefix = workstream === "MAINTENANCE" ? "MAIN" : "IT";
  return `${prefix}-${value}`;
}

export function formatAssetItemCode(workstream: "MAINTENANCE" | "IT", value: number): string {
  const prefix = workstream === "MAINTENANCE" ? "M-AST" : "IT-AST";
  return `${prefix}-${String(value).padStart(3, "0")}`;
}
