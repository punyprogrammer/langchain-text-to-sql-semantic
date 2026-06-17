import {
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useUiStore } from "../../store/chatStore";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-surface-500 bg-surface-200 transition-[width] duration-200 ${
        sidebarCollapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-surface-500 px-3">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-surface-100">
              S
            </div>
            <span className="truncate text-sm font-semibold">Text to SQL</span>
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-2 text-foreground-muted transition hover:bg-surface-400 hover:text-foreground"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 p-2">
        <a
          href="#"
          className={`flex items-center gap-3 rounded-lg bg-brand-muted px-3 py-2 text-sm font-medium text-brand ${
            sidebarCollapsed ? "justify-center px-2" : ""
          }`}
        >
          <MessageSquareText className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>Chatbot</span>}
        </a>
      </nav>

      {!sidebarCollapsed && (
        <div className="border-t border-surface-500 p-3 text-xs text-foreground-subtle">
          Pagila · PostgreSQL
        </div>
      )}
    </aside>
  );
}
