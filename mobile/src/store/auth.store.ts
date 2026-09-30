import { create } from "zustand";
import type { User } from "@/lib/types";

// Same shape as frontend/src/store/auth.store.ts — accessToken/user live in
// memory only (cheap to re-mint via refresh); the refresh token itself is
// persisted separately in expo-secure-store, not here (see src/lib/secureStore.ts).
interface AuthState {
  accessToken: string | null;
  user: User | null;
  hydrated: boolean;
  setSession: (token: string, user: User) => void;
  clearSession: () => void;
  setHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
  setHydrated: (v) => set({ hydrated: v }),
}));
