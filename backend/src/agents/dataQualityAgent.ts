import * as z from "zod";
import { createAgent } from "langchain";
import { SqlDatabase } from "@langchain/classic/sql_db";
import { DATA_QUALITY_PROMPT } from "../config/dataQualityPrompts.js";
import type { DataQualityContext } from "../types/dataQualityContext.js";
import { dataQualityTools } from "../tools/dataQualityTools.js";

const contextSchema = z.object({
  db: z.custom<SqlDatabase>((val) => val instanceof SqlDatabase),
  onProgress: z
    .custom<DataQualityContext["onProgress"]>(() => true)
    .optional(),
});

export const dataQualityReportSchema = z.object({
  report: z
    .string()
    .describe(
      "Markdown data-quality report covering all tables: executive summary, plan, per-table findings, and recommendations.",
    ),
});

const dataQualityAgent = createAgent({
  model:
    process.env.DATA_QUALITY_MODEL ??
    process.env.CHAT_MODEL ??
    "openai:gpt-4o-mini",
  tools: dataQualityTools,
  systemPrompt: DATA_QUALITY_PROMPT,
  contextSchema,
  responseFormat: dataQualityReportSchema,
});

export default dataQualityAgent;
