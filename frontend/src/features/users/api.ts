import { api } from "../../lib/api";
import type { Role, User, Workstream } from "../../lib/types";

export async function fetchUsers(workstream?: Workstream): Promise<User[]> {
  const res = await api.get("/users", { params: workstream ? { workstream } : {} });
  return res.data;
}

export interface CreateUserInput {
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  workstream?: Workstream | null;
  department?: string;
  phone?: string;
}

export async function createUser(input: CreateUserInput): Promise<{ user: User; tempPassword: string }> {
  const res = await api.post("/users", input);
  return res.data;
}

export async function updateUser(id: string, data: Partial<CreateUserInput & { active: boolean }>): Promise<User> {
  const res = await api.patch(`/users/${id}`, data);
  return res.data;
}

export async function resetPassword(id: string): Promise<{ tempPassword: string }> {
  const res = await api.post(`/users/${id}/reset-password`);
  return res.data;
}
