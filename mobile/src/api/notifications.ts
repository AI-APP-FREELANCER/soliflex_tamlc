import { api } from "@/lib/api-client";
import type { AppNotification } from "@/lib/types";

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await api.get("/notifications");
  return res.data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all");
}
