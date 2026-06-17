import * as z from "zod";
import { createAgent } from "langchain";
import { SqlDatabase } from "@langchain/classic/sql_db";
import { executeSqlTool } from "../tools/tools.js";
import { TEXT_TO_SQL_PROMPT } from "../config/prompts.js";
const contextSchema = z.object({
  db: z.custom<SqlDatabase>((val) => val instanceof SqlDatabase),
});

const textToSqlAgent = createAgent({
  model: process.env.CHAT_MODEL ?? "openai:gpt-4o-mini",
  tools: [executeSqlTool],
  systemPrompt: TEXT_TO_SQL_PROMPT,
  contextSchema,
});
export default textToSqlAgent;
