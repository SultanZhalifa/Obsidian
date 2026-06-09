import postgres from "postgres";

/**
 * Promote the `ohlcv` table to a TimescaleDB hypertable partitioned on
 * `open_time` (epoch ms). Idempotent and safe to run repeatedly. If the
 * Timescale extension is unavailable (plain Postgres), it logs and exits 0 so
 * the app still works — the regular B-tree index keeps queries fast at this
 * scale. Invoke after migrations: `tsx src/timescale.ts`.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS timescaledb`;
    // 7 days of milliseconds per chunk (cast to bigint to match open_time).
    const chunkMs = 7 * 24 * 60 * 60 * 1000;
    await sql`
      SELECT create_hypertable(
        'ohlcv', 'open_time',
        chunk_time_interval => ${chunkMs}::bigint,
        if_not_exists => TRUE,
        migrate_data => TRUE
      )
    `;
    console.log("[timescale] ohlcv is now a hypertable");
  } catch (err) {
    console.warn(
      "[timescale] could not enable hypertable (continuing on plain Postgres):",
      (err as Error).message,
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[timescale] failed:", err);
  process.exit(1);
});
