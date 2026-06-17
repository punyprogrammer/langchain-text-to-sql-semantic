import z from "zod";
import { tool } from "langchain";
export const executeSqlTool = tool(
  ({ sql }: { sql: string }, runtime) => {
    return runtime.context.db.run(sql);
  },
  {
    name: "execute_sql",
    description: "Execute a SQL query",
    schema: z.object({
      sql: z.string().describe("The SQL query to execute"),
    }),
  },
);
