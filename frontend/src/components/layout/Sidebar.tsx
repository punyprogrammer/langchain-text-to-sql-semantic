import {
  ClipboardCheck,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { AppView } from "../../store/uiStore";
import { useUiStore } from "../../store/uiStore";

const navItems: { id: AppView; label: string; icon: typeof MessageSquareText }[] =
  [
    { id: "chat", label: "Chatbot", icon: MessageSquareText },
    { id: "data-quality", label: "Data Quality", icon: ClipboardCheck },
  ];

export function Sidebar() {
  const { sidebarCollapsed, activeView, toggleSidebar, setActiveView } =
    useUiStore();

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

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                sidebarCollapsed ? "justify-center px-2" : ""
              } ${
                isActive
                  ? "bg-brand-muted text-brand"
                  : "text-foreground-muted hover:bg-surface-400 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {!sidebarCollapsed && (
        <div className="border-t border-surface-500 p-3 text-xs text-foreground-subtle">
          Pagila · PostgreSQL
        </div>
      )}
    </aside>
  );
}
