import type { AssetType, Role } from "@/lib/types";

export function canCreateAsset(role: Role | undefined, type: AssetType): boolean {
  if (role === "MANAGER" || role === "ADMIN") return true;
  if (type === "maintenance") return role === "PRODUCTION";
  return role === "IT_TEAM";
}
