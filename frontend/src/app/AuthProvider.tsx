import { useEffect, ReactNode } from "react";
import axios from "axios";
import { useAuthStore } from "../store/auth.store";
import { API_BASE_URL } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { accessToken, setSession, clearSession, setHydrated, hydrated } = useAuthStore();

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
      connectSocket(accessToken);
    } else {
      disconnectSocket();
    }
    return () => disconnectSocket();
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
