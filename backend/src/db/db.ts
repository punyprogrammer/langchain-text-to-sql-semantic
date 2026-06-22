import "../config/env.js";
import { DataSource } from "typeorm";
import { SqlDatabase } from "@langchain/classic/sql_db";

let dbPromise: Promise<SqlDatabase> | null = null;
let dataSource: DataSource | null = null;

function getDatabaseUrl(): string {
  const url = process.env.SUPABASE_DB_URL?.trim().replace(/^"|"$/g, "");

  if (!url) {
    throw new Error("SUPABASE_DB_URL is required");
  }

  try {
    new URL(url);
    return url;
  } catch {
    if (url.includes("#")) {
      throw new Error(
        "SUPABASE_DB_URL contains '#'. URL-encode it as '%23' in the password.",
      );
    }

    throw new Error("SUPABASE_DB_URL is invalid");
  }
}

async function initDb(): Promise<SqlDatabase> {
  dataSource = new DataSource({
    type: "postgres",
    url: getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
    schema: "public",
  });

  await dataSource.initialize();

  return SqlDatabase.fromDataSourceParams({
    appDataSource: dataSource,
  });
}

export function getDb(): Promise<SqlDatabase> {
  if (!dbPromise) {
    dbPromise = initDb();
  }

  return dbPromise;
}

export async function runQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  parameters: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  if (!dataSource?.isInitialized) {
    throw new Error("Database is not initialized");
  }

  return dataSource.query(sql, parameters) as Promise<T[]>;
}

export async function closeDb(): Promise<void> {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }

  dataSource = null;
  dbPromise = null;
}
