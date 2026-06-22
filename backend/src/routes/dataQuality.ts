import { Router } from "express";
import { z } from "zod";
import { streamDataQualityAnalysis } from "../services/streamDataQuality.js";

const analyzeRequestSchema = z.object({
  schema: z.string().trim().min(1).default("public"),
});

const router = Router();

router.post("/analyze", async (req, res) => {
  const parsed = analyzeRequestSchema.safeParse(req.body ?? {});

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

  await streamDataQualityAnalysis(
    parsed.data.schema,
    res,
    abortController.signal,
  );
});

export default router;
