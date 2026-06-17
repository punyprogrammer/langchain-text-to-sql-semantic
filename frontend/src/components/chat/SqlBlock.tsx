import hljs from "highlight.js/lib/core";
import sql from "highlight.js/lib/languages/sql";

hljs.registerLanguage("sql", sql);

interface SqlBlockProps {
  code: string;
  className?: string;
}

export function SqlBlock({ code, className = "" }: SqlBlockProps) {
  const highlighted = hljs.highlight(code, { language: "sql" }).value;

  return (
    <pre
      className={`sql-block overflow-x-auto rounded-md bg-surface-100 p-2 text-xs leading-relaxed ${className}`}
    >
      <code
        className="hljs language-sql"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
}

export function getSqlFromInput(input: unknown): string | null {
  if (
    input &&
    typeof input === "object" &&
    "sql" in input &&
    typeof (input as { sql: unknown }).sql === "string"
  ) {
    return (input as { sql: string }).sql;
  }

  return null;
}

export function truncateSql(sql: string, maxLength = 72): string {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength)}…`;
}
