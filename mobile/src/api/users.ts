import { api } from "@/lib/api-client";
import type { User } from "@/lib/types";

export async function fetchUsers(): Promise<User[]> {
  const res = await api.get("/users");
  return res.data;
}
