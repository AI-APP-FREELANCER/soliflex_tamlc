import axios from "axios";
import { useAuthStore } from "../store/auth.store";

// Falls back to "" (relative, same-origin) rather than a hardcoded host — the
// production Nginx setup serves the frontend and reverse-proxies /api to the
// backend under the same domain, so no VITE_API_BASE_URL override is needed
// there. Local dev sets it explicitly in frontend/.env since Vite's dev
// server and the backend run on different ports.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
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
    const res = await axios.post(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      { withCredentials: true }
    );
    const token = res.data.accessToken as string;
    useAuthStore.getState().setSession(token, res.data.user);
    return token;
  } catch {
    useAuthStore.getState().clearSession();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
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

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.data?.error) return err.response.data.error;
    if (err.code === "ECONNABORTED") return "The request timed out. Please try again.";
    // No response at all means the request never reached the server (network
    // down, CORS block, DNS failure, etc.) — axios's own err.message for this
    // ("Network Error") is not something an end user should see verbatim.
    return "Unable to reach the server. Please check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
