import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { streamChatResponse } from "../services/streamChat.js";

const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1, "message is required").optional(),
    thread_id: z.string().uuid().optional(),
    hitl_decision: z.enum(["approve", "reject"]).optional(),
  })
  .refine((data) => data.message || data.hitl_decision, {
    message: "Either message or hitl_decision is required",
  })
  .refine((data) => !data.hitl_decision || data.thread_id, {
    message: "thread_id is required when submitting an approval decision",
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
    {
      message: parsed.data.message,
      threadId,
      hitlDecision: parsed.data.hitl_decision,
    },
    res,
    abortController.signal,
  );
});

export default router;
