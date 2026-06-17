import type { StreamStatus } from "../../types/chat";
import { useTypewriter } from "../../hooks/useTypewriter";
import { MarkdownContent } from "./MarkdownContent";

interface TypewriterMarkdownProps {
  text: string;
  messageId: string;
  streamStatus: StreamStatus;
}

export function TypewriterMarkdown({
  text,
  messageId,
  streamStatus,
}: TypewriterMarkdownProps) {
  const { visibleText, isTyping } = useTypewriter({
    text,
    streamStatus,
    resetKey: messageId,
  });

  return (
    <>
      <MarkdownContent content={visibleText} />
      {isTyping && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand align-middle" />
      )}
    </>
  );
}
