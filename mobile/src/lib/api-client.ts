import axios from "axios";
import { API_BASE_URL } from "@/lib/env";
import { useAuthStore } from "@/store/auth.store";
import { getStoredRefreshToken, setStoredRefreshToken, clearStoredRefreshToken } from "@/lib/secureStore";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "X-Client-Type": "mobile" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) return null;
    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { headers: { "X-Client-Type": "mobile" } }
    );
    const token = res.data.accessToken as string;
    useAuthStore.getState().setSession(token, res.data.user);
    return token;
  } catch {
    useAuthStore.getState().clearSession();
    await clearStoredRefreshToken();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 403 && error.response?.data?.code === "PASSWORD_RESET_REQUIRED") {
      const { user, accessToken, setSession } = useAuthStore.getState();
      if (user && accessToken && !user.mustResetPassword) setSession(accessToken, { ...user, mustResetPassword: true });
    }
    if (error.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const token = await refreshPromise;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

/** Called once at login/register — persists the refresh token securely. */
export async function persistRefreshToken(refreshToken: string): Promise<void> {
  await setStoredRefreshToken(refreshToken);
}

/** Called once at cold start — tries to restore a session from the stored refresh token. */
export async function bootstrapSession(): Promise<void> {
  await refreshAccessToken();
}

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.data?.error) return err.response.data.error;
    if (err.code === "ECONNABORTED") return "The request timed out. Please try again.";
    return "Unable to reach the server. Please check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
