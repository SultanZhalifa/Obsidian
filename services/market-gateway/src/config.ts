import type { Timeframe } from "@obsidian/core";

function envList(name: string, fallback: string): string[] {
  return (process.env[name] ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.GATEWAY_PORT ?? 8080),
  wsPath: process.env.GATEWAY_WS_PATH ?? "/stream",
  /** Lowercase Binance symbols, e.g. btcusdt. */
  symbols: envList("SYMBOLS", "btcusdt,ethusdt,solusdt,bnbusdt,xrpusdt").map((s) =>
    s.toLowerCase(),
  ),
  timeframes: envList("TIMEFRAMES", "1m,5m,15m,1h,4h,1d") as Timeframe[],
  // Binance's official public market-data mirror. Same REST/WS surface, no API
  // key, real data, and reachable from regions where api.binance.com is blocked.
  // Override via env to point at api.binance.com if preferred.
  binanceRest: process.env.BINANCE_REST_BASE ?? "https://data-api.binance.vision",
  binanceWs: process.env.BINANCE_WS_BASE ?? "wss://data-stream.binance.vision",
  databaseUrl: process.env.DATABASE_URL,
  /** How many historical candles to backfill per symbol/timeframe at boot. */
  backfillLimit: Number(process.env.BACKFILL_LIMIT ?? 500),
} as const;
