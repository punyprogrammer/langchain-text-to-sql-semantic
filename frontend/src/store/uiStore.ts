import { create } from "zustand";

export type AppView = "chat" | "data-quality";

interface UiState {
  sidebarCollapsed: boolean;
  activeView: AppView;
  toggleSidebar: () => void;
  setActiveView: (view: AppView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  activeView: "chat",
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setActiveView: (view) => set({ activeView: view }),
}));
