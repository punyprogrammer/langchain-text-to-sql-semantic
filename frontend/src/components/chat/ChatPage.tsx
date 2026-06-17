import { Trash2 } from "lucide-react";
import { useChatStore } from "../../store/chatStore";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

export function ChatPage() {
  const { clearChat, isStreaming, messages } = useChatStore();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-surface-500 px-4 md:px-8">
        <div>
          <h1 className="text-sm font-semibold text-foreground">Chatbot</h1>
          <p className="text-xs text-foreground-subtle">
            Natural language → SQL → streamed answer
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            disabled={isStreaming}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-500 px-3 py-1.5 text-xs text-foreground-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear chat
          </button>
        )}
      </header>

      <MessageList />
      <ChatInput />
    </div>
  );
}
