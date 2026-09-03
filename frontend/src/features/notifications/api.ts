import { api } from "../../lib/api";
import type { Notification } from "../../lib/types";

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await api.get("/notifications");
  return res.data;
}

export async function markNotificationRead(id: string) {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
}
