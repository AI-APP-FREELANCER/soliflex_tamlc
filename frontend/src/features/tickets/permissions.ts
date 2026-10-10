import type { Role, TicketCategory, Workstream } from "../../lib/types";

export const MAINTENANCE_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "PRODUCTION_MACHINE", label: "Production Machine" },
  { value: "FACTORY_FACILITY", label: "Factory / Facility" },
  { value: "OTHER_MACHINE", label: "Other Machine" },
];

export const IT_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "WORKSTATION", label: "Workstation" },
  { value: "LAPTOP", label: "Laptop" },
  { value: "NETWORK_GEAR", label: "Network Gear" },
  { value: "SERVER", label: "Server" },
  { value: "SOFTWARE", label: "Software" },
];

/**
 * Which workstream a board user works in. Maintenance and IT are separate
 * workflows, so each user only sees their own. null = may see both.
 * (Mirrors backend/src/lib/workstream-scope.ts.)
 */
export function workstreamScopeFor(user: { role: Role; workstream: Workstream | null }): Workstream | null {
  switch (user.role) {
    case "MECHANIC":
    case "PRODUCTION":
      return "MAINTENANCE";
    case "IT_TEAM":
      return "IT";
    case "MANAGER":
      return user.workstream ?? null;
    default:
      return null;
  }
}

export function categoriesFor(workstream: Workstream) {
  return workstream === "MAINTENANCE" ? MAINTENANCE_CATEGORIES : IT_CATEGORIES;
}

export function allowedWorkstreamsForCreate(role: Role): Workstream[] {
  switch (role) {
    case "MANAGER":
    case "ADMIN":
      return ["MAINTENANCE", "IT"];
    case "PRODUCTION":
      return ["MAINTENANCE"];
    case "IT_TEAM":
      return ["IT"];
    default:
      return [];
  }
}

export function allowedCategoriesForCreate(role: Role, workstream: Workstream): TicketCategory[] {
  if (role === "MANAGER" || role === "ADMIN") return categoriesFor(workstream).map((c) => c.value);
  if (workstream === "MAINTENANCE") {
    if (role === "PRODUCTION") return ["PRODUCTION_MACHINE"];
    return [];
  }
  if (workstream === "IT" && role === "IT_TEAM") return IT_CATEGORIES.map((c) => c.value);
  return [];
}
