import { api } from "../../lib/api";
import type { UserDepartment } from "../../lib/types";

export async function fetchUserDepartments(all = false): Promise<UserDepartment[]> {
  const res = await api.get("/user-departments", { params: all ? { all: "true" } : {} });
  return res.data;
}

export async function createUserDepartment(name: string): Promise<UserDepartment> {
  const res = await api.post("/user-departments", { name });
  return res.data;
}

export async function updateUserDepartment(id: string, data: { name?: string; active?: boolean }): Promise<UserDepartment> {
  const res = await api.patch(`/user-departments/${id}`, data);
  return res.data;
}

export async function deleteUserDepartment(id: string): Promise<void> {
  await api.delete(`/user-departments/${id}`);
}
