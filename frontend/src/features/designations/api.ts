import { api } from "../../lib/api";
import type { Designation } from "../../lib/types";

export async function fetchDesignations(all = false): Promise<Designation[]> {
  const res = await api.get("/designations", { params: all ? { all: "true" } : {} });
  return res.data;
}

export async function createDesignation(name: string): Promise<Designation> {
  const res = await api.post("/designations", { name });
  return res.data;
}

export async function updateDesignation(id: string, data: { name?: string; active?: boolean }): Promise<Designation> {
  const res = await api.patch(`/designations/${id}`, data);
  return res.data;
}

export async function deleteDesignation(id: string): Promise<void> {
  await api.delete(`/designations/${id}`);
}
