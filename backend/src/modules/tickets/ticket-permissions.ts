import { Role, TicketCategory, Workstream } from "@prisma/client";

const MAINTENANCE_CATEGORIES = new Set<TicketCategory>([
  TicketCategory.PRODUCTION_MACHINE,
  TicketCategory.FACTORY_FACILITY,
  TicketCategory.OTHER_MACHINE,
]);

const IT_CATEGORIES = new Set<TicketCategory>([
  TicketCategory.WORKSTATION,
  TicketCategory.LAPTOP,
  TicketCategory.NETWORK_GEAR,
  TicketCategory.SERVER,
  TicketCategory.SOFTWARE,
]);

/**
 * Spec §1 — Workstreams & System Access:
 * - Maintenance tickets: Production team (Production Machines) or Admin team
 *   (Factory/Facility Maintenance & Other Machines).
 * - IT tickets: IT Department team only.
 * Managers can raise a ticket in any category as part of their oversight role.
 */
export function canCreateTicket(role: Role, workstream: Workstream, category: TicketCategory): boolean {
  if (role === Role.MANAGER) return true;

  if (workstream === Workstream.MAINTENANCE) {
    if (!MAINTENANCE_CATEGORIES.has(category)) return false;
    if (category === TicketCategory.PRODUCTION_MACHINE) return role === Role.PRODUCTION;
    return role === Role.ADMIN;
  }

  if (workstream === Workstream.IT) {
    if (!IT_CATEGORIES.has(category)) return false;
    return role === Role.IT_TEAM;
  }

  return false;
}

export function categoriesForWorkstream(workstream: Workstream): TicketCategory[] {
  return workstream === Workstream.MAINTENANCE
    ? Array.from(MAINTENANCE_CATEGORIES)
    : Array.from(IT_CATEGORIES);
}
