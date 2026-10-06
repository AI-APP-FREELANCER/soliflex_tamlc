import { useEffect, useRef, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuthStore } from "../store/auth.store";
import { API_BASE_URL } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { accessToken, setSession, clearSession, setHydrated, hydrated } = useAuthStore();
  const queryClient = useQueryClient();
  const lastRefetch = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refetch every mounted screen when the server says data changed. Leading + trailing throttle:
  // the first signal refetches immediately, a burst of changes gets one final refetch after it.
  function refetchEverything() {
    const run = () => {
      lastRefetch.current = Date.now();
      trailing.current = null;
      queryClient.invalidateQueries();
    };
    if (Date.now() - lastRefetch.current >= 400) run();
    else if (!trailing.current) trailing.current = setTimeout(run, 400);
  }

  useEffect(() => {
    let cancelled = false;
    axios
      .post(`${API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        if (cancelled) return;
        setSession(res.data.accessToken, res.data.user);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (accessToken) {
      connectSocket(accessToken, refetchEverything);
    } else {
      disconnectSocket();
    }
    return () => disconnectSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-soliflex-gray-50">
        <img src="/soliflex-logo.png" alt="Soliflex" className="h-10 animate-pulse" />
      </div>
    );
  }

  return <>{children}</>;
}
