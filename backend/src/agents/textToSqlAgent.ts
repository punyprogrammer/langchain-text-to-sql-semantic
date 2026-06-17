import * as z from "zod";
import { createAgent } from "langchain";
import { SqlDatabase } from "@langchain/classic/sql_db";
import { executeSqlTool } from "../tools/tools.js";
import { TEXT_TO_SQL_PROMPT } from "../config/prompts.js";

const contextSchema = z.object({
  db: z.custom<SqlDatabase>((val) => val instanceof SqlDatabase),
});

export const agentResponseSchema = z.object({
  summary: z
    .string()
    .describe(
      "Markdown-formatted answer for the user. Use headings, bold, lists, and tables where helpful. Include key numbers and insights from query results.",
    ),
});

const textToSqlAgent = createAgent({
  model: process.env.CHAT_MODEL ?? "openai:gpt-4o-mini",
  tools: [executeSqlTool],
  systemPrompt: TEXT_TO_SQL_PROMPT,
  contextSchema,
  responseFormat: agentResponseSchema,
});
export default textToSqlAgent;
