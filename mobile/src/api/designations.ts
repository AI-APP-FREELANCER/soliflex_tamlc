import { api } from "@/lib/api-client";
import type { Designation } from "@/lib/types";

export async function fetchDesignations(): Promise<Designation[]> {
  const res = await api.get("/designations");
  return res.data;
}
