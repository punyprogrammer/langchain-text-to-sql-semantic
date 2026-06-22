import { humanInTheLoopMiddleware } from "langchain";

export const sqlApprovalMiddleware = humanInTheLoopMiddleware({
  interruptOn: {
    execute_sql: {
      allowedDecisions: ["approve", "reject"],
      description: (toolCall) => {
        const sql =
          toolCall.args &&
          typeof toolCall.args === "object" &&
          "sql" in toolCall.args &&
          typeof toolCall.args.sql === "string"
            ? toolCall.args.sql
            : JSON.stringify(toolCall.args, null, 2);

        return `Review this SQL query before it runs against the database:\n\n${sql}`;
      },
    },
  },
  descriptionPrefix: "SQL execution requires your approval",
});
