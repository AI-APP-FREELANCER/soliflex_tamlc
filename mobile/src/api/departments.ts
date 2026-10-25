import { api } from "@/lib/api-client";
import type { Department } from "@/lib/types";

export async function fetchDepartments(): Promise<Department[]> {
  const res = await api.get("/departments");
  return res.data;
}
