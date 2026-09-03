import { create } from "zustand";
import type { Workstream } from "../lib/types";

interface WorkstreamState {
  workstream: Workstream;
  setWorkstream: (w: Workstream) => void;
}

export const useWorkstreamStore = create<WorkstreamState>((set) => ({
  workstream: "MAINTENANCE",
  setWorkstream: (workstream) => set({ workstream }),
}));
