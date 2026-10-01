import { api } from "@/lib/api-client";
import type { AuditEntry, AuditFilter } from "@/lib/types";

export async function fetchAuditLog(filter: AuditFilter): Promise<{ entries: AuditEntry[]; nextCursor: string | null }> {
  const res = await api.get("/audit", {
    params: {
      entityType: filter.entityType,
      cursor: filter.cursor,
      limit: filter.limit,
      range: filter.range,
      from: filter.from,
      to: filter.to,
    },
  });
  return res.data;
}

export async function fetchAuditEntityTypes(): Promise<string[]> {
  const res = await api.get("/audit/entity-types");
  return res.data;
}
