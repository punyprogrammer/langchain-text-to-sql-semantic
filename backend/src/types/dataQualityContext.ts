import type { SqlDatabase } from "@langchain/classic/sql_db";

export interface ToolProgressUpdate {
  label: string;
  current: number;
  total: number;
  item?: string;
}

export interface DataQualityContext {
  db: SqlDatabase;
  onProgress?: (update: ToolProgressUpdate) => void;
}
