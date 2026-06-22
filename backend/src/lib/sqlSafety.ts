const FORBIDDEN_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE)\b/i;

export function normalizeReadOnlySql(sql: string): string {
  let normalized = sql.trim();

  const fenced = normalized.match(/^```(?:sql)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    normalized = fenced[1].trim();
  }

  while (normalized.endsWith(";")) {
    normalized = normalized.slice(0, -1).trimEnd();
  }

  return normalized;
}

export function validateAndNormalizeReadOnlySql(sql: string): string {
  const normalized = normalizeReadOnlySql(sql);

  if (!normalized) {
    throw new Error("SQL query is empty");
  }

  if (normalized.includes(";")) {
    throw new Error("Only a single SQL statement is allowed");
  }

  if (FORBIDDEN_PATTERN.test(normalized)) {
    throw new Error("Only read-only SELECT queries are allowed");
  }

  const startsReadOnly =
    /^(SELECT|WITH|EXPLAIN|TABLE)\b/i.test(normalized) ||
    /^SHOW\b/i.test(normalized);

  if (!startsReadOnly) {
    throw new Error(
      "Query must start with SELECT, WITH, EXPLAIN, TABLE, or SHOW",
    );
  }

  return normalized;
}

export function assertReadOnlySql(sql: string): void {
  validateAndNormalizeReadOnlySql(sql);
}
