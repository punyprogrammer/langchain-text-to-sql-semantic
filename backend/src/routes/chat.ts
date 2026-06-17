import { Router } from "express";
import { z } from "zod";
import { streamChatResponse } from "../services/streamChat.js";

const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "message is required"),
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

  await streamChatResponse(
    parsed.data.message,
    res,
    abortController.signal,
  );
});

export default router;
