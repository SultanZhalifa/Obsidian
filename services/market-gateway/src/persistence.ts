import { sql as rawSql } from "@obsidian/db";
import { ohlcv } from "@obsidian/db/schema";
import type { Candle, Timeframe } from "@obsidian/core";
import { db } from "@obsidian/db";
import { logger, errInfo } from "./logger.js";

/**
 * Persist a closed candle (idempotent upsert keyed by symbol+timeframe+openTime).
 * Called only when a kline closes, so the table holds finalized OHLCV.
 */
export async function persistCandle(
  symbol: string,
  timeframe: Timeframe,
  candle: Candle,
): Promise<void> {
  try {
    await db
      .insert(ohlcv)
      .values({
        symbol: symbol.toUpperCase(),
        timeframe,
        openTime: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        closed: true,
      })
      .onConflictDoUpdate({
        target: [ohlcv.symbol, ohlcv.timeframe, ohlcv.openTime],
        set: {
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          closed: true,
        },
      });
  } catch (err) {
    logger.error(
      { err: errInfo(err), symbol, timeframe },
      "failed to persist candle",
    );
  }
}

/** Liveness check used by /health: a trivial round-trip to Postgres. */
export async function dbHealthy(): Promise<boolean> {
  try {
    await rawSql`select 1`;
    return true;
  } catch {
    return false;
  }
}
