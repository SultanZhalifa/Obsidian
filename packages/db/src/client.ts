import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
    );
  }
  return url;
}

/**
 * Lazily-created singleton Postgres connection + Drizzle instance.
 * A single pooled client is shared across the process; Next.js dev hot-reload
 * reuses the global to avoid exhausting connections.
 */
const globalForDb = globalThis as unknown as {
  __obsidianSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__obsidianSql ??
  postgres(databaseUrl(), { max: 10, prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__obsidianSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql, schema };
export type Database = typeof db;
