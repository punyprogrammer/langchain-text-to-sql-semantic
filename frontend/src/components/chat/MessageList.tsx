import { useEffect, useRef } from "react";
import { useChatStore } from "../../store/chatStore";
import { AssistantMessageView } from "./AssistantMessageView";
import { UserMessageView } from "./UserMessageView";

export function MessageList() {
  const messages = useChatStore((state) => state.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-muted text-xl font-bold text-brand">
          SQL
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Ask questions about your database
        </h2>
        <p className="mt-2 max-w-md text-sm text-foreground-muted">
          Natural language queries are translated to SQL, executed against
          Pagila, and streamed back with tool call details.
        </p>
        <div className="mt-6 grid gap-2 text-left text-sm text-foreground-muted">
          <p>• How many films are in the database?</p>
          <p>• Which 5 actors appear in the most films?</p>
          <p>• What is the total revenue by store?</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessageView key={message.id} content={message.content} />
        ) : (
          <AssistantMessageView key={message.id} message={message} />
        ),
      )}
      <div ref={bottomRef} />
    </div>
  );
}
