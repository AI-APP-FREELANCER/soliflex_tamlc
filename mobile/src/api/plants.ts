import { api } from "@/lib/api-client";
import type { Plant } from "@/lib/types";

export async function fetchPlants(): Promise<Plant[]> {
  const res = await api.get("/plants");
  return res.data;
}
