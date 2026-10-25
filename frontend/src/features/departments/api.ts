import { api } from "../../lib/api";
import type { Department } from "../../lib/types";

export async function fetchDepartments(all = false): Promise<Department[]> {
  const res = await api.get("/departments", { params: all ? { all: "true" } : {} });
  return res.data;
}

export async function createDepartment(name: string): Promise<Department> {
  const res = await api.post("/departments", { name });
  return res.data;
}

export async function updateDepartment(id: string, data: { name?: string; active?: boolean }): Promise<Department> {
  const res = await api.patch(`/departments/${id}`, data);
  return res.data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`/departments/${id}`);
}
