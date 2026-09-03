import { create } from "zustand";

interface UIState {
  createTicketOpen: boolean;
  setCreateTicketOpen: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  createTicketOpen: false,
  setCreateTicketOpen: (v) => set({ createTicketOpen: v }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
}));
