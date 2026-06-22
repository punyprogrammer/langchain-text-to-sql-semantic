import z from "zod";
import { tool } from "langchain";
import { validateAndNormalizeReadOnlySql } from "../lib/sqlSafety.js";

export const executeSqlTool = tool(
  ({ sql }: { sql: string }, runtime) => {
    const normalizedSql = validateAndNormalizeReadOnlySql(sql);
    return runtime.context.db.run(normalizedSql);
  },
  {
    name: "execute_sql",
    description: "Execute a SQL query",
    schema: z.object({
      sql: z.string().describe("The SQL query to execute"),
    }),
  },
);
