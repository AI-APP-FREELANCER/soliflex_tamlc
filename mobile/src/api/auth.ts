import { api } from "@/lib/api-client";
import type { User } from "@/lib/types";

export interface LoginResponse {
  accessToken: string;
  user: User;
  refreshToken: string; // present because we send X-Client-Type: mobile
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

export interface RegisterInput {
  employeeId: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export async function registerEmployee(input: RegisterInput): Promise<LoginResponse> {
  const res = await api.post("/auth/register", input);
  return res.data;
}

export async function fetchMe(): Promise<User> {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function logout(refreshToken: string | null): Promise<void> {
  await api.post("/auth/logout", refreshToken ? { refreshToken } : {});
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/change-password", { currentPassword, newPassword });
}
