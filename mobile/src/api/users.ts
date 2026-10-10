import { api } from "@/lib/api-client";
import type { Role, User, Workstream } from "@/lib/types";

export async function fetchUsers(): Promise<User[]> {
  const res = await api.get("/users");
  return res.data;
}

export interface CreateUserInput {
  employeeId: string;
  name: string;
  /** Provide an email, a mobile number, or both. */
  email?: string;
  role: Role;
  workstream?: Workstream | null;
  department?: string;
  phone?: string;
}

export async function createUser(input: CreateUserInput): Promise<{ user: User; tempPassword: string }> {
  const res = await api.post("/users", input);
  return res.data;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  workstream?: Workstream | null;
  department?: string;
  email?: string;
  phone?: string | null;
  active?: boolean;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const res = await api.patch(`/users/${id}`, input);
  return res.data;
}

export async function resetUserPassword(id: string): Promise<{ ok: true; tempPassword: string }> {
  const res = await api.post(`/users/${id}/reset-password`);
  return res.data;
}
