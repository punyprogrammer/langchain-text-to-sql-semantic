import z from "zod";
import { tool } from "langchain";
import type { SqlDatabase } from "@langchain/classic/sql_db";
import { runQuery } from "../db/db.js";
import { validateAndNormalizeReadOnlySql } from "../lib/sqlSafety.js";
import type { DataQualityContext } from "../types/dataQualityContext.js";

const checkSchema = z.object({
  id: z.string().describe("Stable check id, e.g. null-rate, duplicate-pk"),
  name: z.string().describe("Human-readable check name"),
  description: z.string().describe("What this check validates"),
  tables: z
    .array(z.string())
    .describe('Tables this check applies to; use ["*"] for all tables'),
});

const qualityCheckInputSchema = z.object({
  sql: z.string().describe("A single read-only SELECT (or WITH ... SELECT)"),
  purpose: z
    .string()
    .describe('Short label for this check, e.g. "null rate for customer.email"'),
});

async function profileTable(schema: string, table: string) {
  const columns = await runQuery<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table],
  );

  const primaryKey = await runQuery<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = $1
       AND tc.table_name = $2
       AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position`,
    [schema, table],
  );

  const foreignKeys = await runQuery<{
    column_name: string;
    foreign_table_schema: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }>(
    `SELECT
       kcu.column_name,
       ccu.table_schema AS foreign_table_schema,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.table_schema = $1
       AND tc.table_name = $2
       AND tc.constraint_type = 'FOREIGN KEY'
     ORDER BY kcu.column_name`,
    [schema, table],
  );

  const rowEstimate = await runQuery<{ estimated_row_count: string }>(
    `SELECT COALESCE(c.reltuples::bigint, 0) AS estimated_row_count
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = $2`,
    [schema, table],
  );

  return {
    schema,
    table,
    columns,
    primaryKey: primaryKey.map((row) => row.column_name),
    foreignKeys,
    estimatedRowCount: Number(rowEstimate[0]?.estimated_row_count ?? 0),
  };
}

function getContext(runtime: unknown): DataQualityContext {
  return (runtime as { context: DataQualityContext }).context;
}

export const createAnalysisPlanTool = tool(
  ({ schema, tables, checks, notes }) => {
    const resolvedSchema = schema.trim() || "public";
    const resolvedNotes = notes.trim() || null;

    return JSON.stringify(
      {
        status: "accepted",
        schema: resolvedSchema,
        tableCount: tables.length,
        tables,
        checks,
        notes: resolvedNotes,
        message:
          "Plan recorded. Proceed with list_tables, scan_tables, and run_quality_checks.",
      },
      null,
      2,
    );
  },
  {
    name: "create_analysis_plan",
    description:
      "REQUIRED first step. Record the data-quality analysis plan before touching the database. List every table and every check that will run.",
    schema: z.object({
      schema: z
        .string()
        .describe("PostgreSQL schema to analyze (use public for the default schema)"),
      tables: z.array(z.string()).min(1).describe("Tables to include in the analysis"),
      checks: z.array(checkSchema).min(1).describe("Checks to execute"),
      notes: z
        .string()
        .describe("Planning notes or assumptions; use an empty string if none"),
    }),
  },
);

export const listTablesTool = tool(
  async ({ schema }) => {
    const resolvedSchema = schema.trim() || "public";
    const rows = await runQuery<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [resolvedSchema],
    );

    const tables = rows.map((row) => row.table_name);

    return JSON.stringify(
      { schema: resolvedSchema, tables, count: tables.length },
      null,
      2,
    );
  },
  {
    name: "list_tables",
    description: "List all base tables in a PostgreSQL schema.",
    schema: z.object({
      schema: z
        .string()
        .describe("Schema name (use public for the default schema)"),
    }),
  },
);

export const scanTablesTool = tool(
  async ({ schema, tables }, runtime) => {
    const { onProgress } = getContext(runtime);
    const resolvedSchema = schema.trim() || "public";

    let tablesToScan = tables;
    if (tablesToScan.length === 0) {
      const rows = await runQuery<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [resolvedSchema],
      );
      tablesToScan = rows.map((row) => row.table_name);
    }

    const profiles = [];
    const total = tablesToScan.length;

    for (let index = 0; index < tablesToScan.length; index++) {
      const table = tablesToScan[index];
      onProgress?.({
        label: "Scanning tables",
        current: index + 1,
        total,
        item: table,
      });

      profiles.push(await profileTable(resolvedSchema, table));
    }

    return JSON.stringify(
      {
        schema: resolvedSchema,
        tableCount: profiles.length,
        profiles,
      },
      null,
      2,
    );
  },
  {
    name: "scan_tables",
    description:
      "Scan and profile multiple tables in one call. Returns columns, keys, foreign keys, and row counts for every table.",
    schema: z.object({
      schema: z
        .string()
        .describe("Schema name (use public for the default schema)"),
      tables: z
        .array(z.string())
        .describe(
          "Tables to scan. Pass every table from list_tables. Use an empty array to scan all tables in the schema.",
        ),
    }),
  },
);

export const runQualityChecksTool = tool(
  async ({ checks }, runtime) => {
    const { db, onProgress } = getContext(runtime);
    const total = checks.length;
    const results: Array<{
      purpose: string;
      sql: string;
      result?: string;
      error?: string;
    }> = [];

    for (let index = 0; index < checks.length; index++) {
      const check = checks[index];
      onProgress?.({
        label: "Running quality checks",
        current: index + 1,
        total,
        item: check.purpose,
      });

      try {
        const sql = validateAndNormalizeReadOnlySql(check.sql);
        const result = await db.run(sql);
        results.push({
          purpose: check.purpose,
          sql,
          result,
        });
      } catch (error) {
        results.push({
          purpose: check.purpose,
          sql: check.sql,
          error: error instanceof Error ? error.message : "Check failed",
        });
      }
    }

    const failed = results.filter((entry) => entry.error).length;

    return JSON.stringify(
      {
        checkCount: results.length,
        failed,
        results,
      },
      null,
      2,
    );
  },
  {
    name: "run_quality_checks",
    description:
      "Run multiple read-only quality-check queries in one call. Batch every planned SQL check into as few invocations as possible.",
    schema: z.object({
      checks: z
        .array(qualityCheckInputSchema)
        .min(1)
        .describe("All quality-check queries to execute"),
    }),
  },
);

export const dataQualityTools = [
  createAnalysisPlanTool,
  listTablesTool,
  scanTablesTool,
  runQualityChecksTool,
];
