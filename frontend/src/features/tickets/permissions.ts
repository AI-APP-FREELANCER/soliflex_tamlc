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

export function categoriesFor(workstream: Workstream) {
  return workstream === "MAINTENANCE" ? MAINTENANCE_CATEGORIES : IT_CATEGORIES;
}

export function allowedWorkstreamsForCreate(role: Role): Workstream[] {
  switch (role) {
    case "MANAGER":
      return ["MAINTENANCE", "IT"];
    case "PRODUCTION":
    case "ADMIN":
      return ["MAINTENANCE"];
    case "IT_TEAM":
      return ["IT"];
    default:
      return [];
  }
}

export function allowedCategoriesForCreate(role: Role, workstream: Workstream): TicketCategory[] {
  if (role === "MANAGER") return categoriesFor(workstream).map((c) => c.value);
  if (workstream === "MAINTENANCE") {
    if (role === "PRODUCTION") return ["PRODUCTION_MACHINE"];
    if (role === "ADMIN") return ["FACTORY_FACILITY", "OTHER_MACHINE"];
    return [];
  }
  if (workstream === "IT" && role === "IT_TEAM") return IT_CATEGORIES.map((c) => c.value);
  return [];
}
