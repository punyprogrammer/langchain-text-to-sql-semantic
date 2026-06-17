import { useEffect, useState } from "react";
import type { StreamStatus } from "../types/chat";

interface UseTypewriterOptions {
  text: string;
  streamStatus: StreamStatus;
  charsPerTick?: number;
  tickMs?: number;
  resetKey?: string;
}

export function useTypewriter({
  text,
  streamStatus,
  charsPerTick = 2,
  tickMs = 20,
  resetKey,
}: UseTypewriterOptions) {
  const [visibleLength, setVisibleLength] = useState(() =>
    streamStatus === "done" ? text.length : 0,
  );

  useEffect(() => {
    setVisibleLength(streamStatus === "done" ? text.length : 0);
  }, [resetKey]);

  const isStreaming = streamStatus === "streaming";
  const enabled = isStreaming || visibleLength < text.length;

  useEffect(() => {
    if (!enabled || visibleLength >= text.length) return;

    const timer = window.setInterval(() => {
      setVisibleLength((current) => Math.min(current + charsPerTick, text.length));
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [text, visibleLength, enabled, charsPerTick, tickMs]);

  return {
    visibleText: text.slice(0, visibleLength),
    isTyping: enabled && visibleLength < text.length,
  };
}
