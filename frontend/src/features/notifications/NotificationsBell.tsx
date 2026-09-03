import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "./api";
import { getSocket } from "../../lib/socket";
import { useAuthStore } from "../../store/auth.store";
import type { Notification } from "../../lib/types";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/Spinner";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: !!accessToken,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (notification: Notification) => {
      queryClient.setQueryData<Notification[]>(["notifications"], (old = []) => [notification, ...old]);
      toast(notification.message, { icon: "🔔" });
    };
    socket.on("notification", handler);
    return () => {
      socket.off("notification", handler);
    };
  }, [accessToken, queryClient]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleClick(n: Notification) {
    if (!n.read) {
      await markNotificationRead(n.id);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-soliflex-gray-500 hover:bg-soliflex-gray-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-soliflex-orange-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 rounded-xl border border-soliflex-gray-100 bg-white shadow-popover">
          <div className="flex items-center justify-between border-b border-soliflex-gray-100 px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  await markAllNotificationsRead();
                  queryClient.invalidateQueries({ queryKey: ["notifications"] });
                }}
                className="text-xs font-medium text-soliflex-orange-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No notifications yet" />
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`block w-full border-b border-soliflex-gray-50 px-4 py-3 text-left text-sm hover:bg-soliflex-gray-50 ${
                    !n.read ? "bg-soliflex-orange-50/40" : ""
                  }`}
                >
                  <p className="text-soliflex-ink">{n.message}</p>
                  <p className="mt-1 text-xs text-soliflex-gray-400">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
