import { api } from "../../lib/api";
import type { AuditEntry } from "../../lib/types";

export interface AuditPage {
  entries: AuditEntry[];
  nextCursor: string | null;
}

export async function fetchAuditLog(params: { entityType?: string; cursor?: string; limit?: number }): Promise<AuditPage> {
  const res = await api.get("/audit", { params });
  return res.data;
}

export async function fetchAuditEntityTypes(): Promise<string[]> {
  const res = await api.get("/audit/entity-types");
  return res.data;
}
