import { api } from "../../lib/api";
import type { Plant } from "../../lib/types";

export async function fetchPlants(all = false): Promise<Plant[]> {
  const res = await api.get("/plants", { params: all ? { all: "true" } : {} });
  return res.data;
}

export async function createPlant(name: string): Promise<Plant> {
  const res = await api.post("/plants", { name });
  return res.data;
}

export async function updatePlant(id: string, data: { name?: string; active?: boolean }): Promise<Plant> {
  const res = await api.patch(`/plants/${id}`, data);
  return res.data;
}

export async function deletePlant(id: string): Promise<void> {
  await api.delete(`/plants/${id}`);
}
