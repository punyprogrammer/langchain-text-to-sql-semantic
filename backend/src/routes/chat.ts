import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { streamChatResponse } from "../services/streamChat.js";

const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "message is required"),
  thread_id: z.string().uuid().optional(),
});

const router = Router();

router.post("/", async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
    return;
  }

  const abortController = new AbortController();

  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  const threadId = parsed.data.thread_id ?? randomUUID();

  await streamChatResponse(
    parsed.data.message,
    threadId,
    res,
    abortController.signal,
  );
});

export default router;
