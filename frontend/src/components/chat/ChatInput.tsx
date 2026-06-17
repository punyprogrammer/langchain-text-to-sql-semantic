import { useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export function ChatInput() {
  const [input, setInput] = useState("");
  const { isStreaming, sendMessage, stopStreaming } = useChatStore();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input;
    setInput("");
    await sendMessage(message);
  };

  return (
    <div className="border-t border-surface-500 bg-surface-200 px-4 py-4 md:px-8">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
        <div className="relative flex-1">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit(event);
              }
            }}
            rows={1}
            placeholder="Ask a question about the database..."
            disabled={isStreaming}
            className="min-h-[52px] w-full resize-none rounded-xl border border-surface-500 bg-surface-100 px-4 py-3 pr-12 text-sm text-foreground outline-none transition placeholder:text-foreground-subtle focus:border-brand disabled:opacity-60"
          />
        </div>

        {isStreaming ? (
          <button
            type="button"
            onClick={stopStreaming}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-surface-500 bg-surface-300 text-foreground-muted transition hover:border-danger hover:text-danger"
            aria-label="Stop streaming"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-brand text-surface-100 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </form>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-foreground-subtle">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
