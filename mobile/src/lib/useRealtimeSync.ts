import { useEffect } from "react";
import { AppState } from "react-native";
import { io } from "socket.io-client";
import { API_BASE_URL } from "@/lib/env";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { fetchMe } from "@/api/auth";

// The socket server lives on the API origin, not under /api.
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

/**
 * Live updates: the server broadcasts "data-changed" after any ticket/helpdesk/
 * asset/user change (and when a deadline passes); every mounted screen refetches
 * at once. Also catches up on (re)connect and when the app returns to foreground.
 */
export function useRealtimeSync() {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;

    let disposed = false;
    let lastRefetch = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;

    // Leading + trailing throttle: first signal refetches now, a burst gets one final refetch.
    function refetchEverything() {
      const run = () => {
        lastRefetch = Date.now();
        trailing = null;
        queryClient.invalidateQueries();
      };
      if (Date.now() - lastRefetch >= 400) run();
      else if (!trailing) trailing = setTimeout(run, 400);
    }

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      // A function, so every reconnect handshake uses the latest refreshed token.
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      reconnectionDelayMax: 5000,
    });

    socket.on("data-changed", refetchEverything);
    socket.on("connect", refetchEverything);
    socket.on("notification", () => queryClient.invalidateQueries({ queryKey: ["notifications"] }));

    // An expired token is rejected at handshake and socket.io does not retry on its own:
    // any API call refreshes the token, then reconnect.
    socket.on("connect_error", async () => {
      await fetchMe().catch(() => undefined);
      if (!disposed && !socket.active) setTimeout(() => !disposed && socket.connect(), 3000);
    });

    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!socket.connected) socket.connect();
      refetchEverything();
    });

    return () => {
      disposed = true;
      if (trailing) clearTimeout(trailing);
      appState.remove();
      socket.disconnect();
    };
  }, [userId]);
}
