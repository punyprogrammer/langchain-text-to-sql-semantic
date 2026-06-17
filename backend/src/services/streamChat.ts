import type { Response } from "express";
import type { BaseMessage } from "@langchain/core/messages";
import textToSqlAgent from "../agents/textToSqlAgent.js";
import { getDb } from "../db/db.js";
import { initSse, sendSseEvent } from "../lib/sse.js";

function getMessageText(message: BaseMessage | undefined): string {
  if (!message) return "";

  if (typeof message.text === "string" && message.text.length > 0) {
    return message.text;
  }

  const { content } = message;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (
          block &&
          typeof block === "object" &&
          "type" in block &&
          block.type === "text" &&
          "text" in block &&
          typeof block.text === "string"
        ) {
          return block.text;
        }
        return "";
      })
      .join("");
  }

  return "";
}

export async function streamChatResponse(
  message: string,
  res: Response,
  signal: AbortSignal,
): Promise<void> {
  initSse(res);
  sendSseEvent(res, "started", {});

  try {
    const db = await getDb();

    const run = await textToSqlAgent.streamEvents(
      { messages: [{ role: "user", content: message }] },
      { version: "v3", context: { db }, signal },
    );

    const streamMessages = async () => {
      for await (const msg of run.messages) {
        for await (const token of msg.text) {
          if (signal.aborted) return;
          sendSseEvent(res, "token", { content: token });
        }
      }
    };

    const streamToolCalls = async () => {
      for await (const call of run.toolCalls) {
        if (signal.aborted) return;

        sendSseEvent(res, "tool_start", {
          name: call.name,
          callId: call.callId,
          input: call.input,
        });

        try {
          const output = await call.output;
          sendSseEvent(res, "tool_result", {
            name: call.name,
            callId: call.callId,
            output,
          });
        } catch (error) {
          sendSseEvent(res, "tool_error", {
            name: call.name,
            callId: call.callId,
            message: error instanceof Error ? error.message : "Tool failed",
          });
        }
      }
    };

    await Promise.all([streamMessages(), streamToolCalls()]);

    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    const finalState = await run.output;
    const lastMessage = finalState.messages.at(-1) as BaseMessage | undefined;
    const content = getMessageText(lastMessage);

    sendSseEvent(res, "done", { content });
  } catch (error) {
    if (signal.aborted) {
      sendSseEvent(res, "cancelled", {});
      return;
    }

    sendSseEvent(res, "error", {
      message: error instanceof Error ? error.message : "Stream failed",
    });
    console.error("[chat] stream error:", error);
  } finally {
    res.end();
  }
}
