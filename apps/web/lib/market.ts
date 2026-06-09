import "server-only";
import type { Candle, Timeframe } from "@obsidian/core";
import { serverEnv } from "./env.js";

/**
 * Server-side fetch of historical candles for first paint (SSR / route handler).
 * Hits Binance's public REST mirror directly — real data, no key. The live
 * gateway WS then streams deltas on top of this initial backfill.
 */
export async function getKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  const url = new URL("/api/v3/klines", serverEnv.binanceRest);
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("interval", timeframe);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Candles for the current bar change every second; cache briefly.
    next: { revalidate: 5 },
  });
  if (!res.ok) {
    throw new Error(`klines ${symbol} ${timeframe}: ${res.status}`);
  }
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
}

/** 24h ticker snapshot for one or more symbols (real data, for SSR watchlist). */
export async function getTicker24h(symbols: string[]): Promise<Ticker24h[]> {
  const url = new URL("/api/v3/ticker/24hr", serverEnv.binanceRest);
  url.searchParams.set(
    "symbols",
    JSON.stringify(symbols.map((s) => s.toUpperCase())),
  );
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 5 },
  });
  if (!res.ok) throw new Error(`ticker24h: ${res.status}`);
  const raw = (await res.json()) as Record<string, string>[];
  return raw.map((t) => ({
    symbol: String(t.symbol),
    lastPrice: Number(t.lastPrice),
    priceChangePercent: Number(t.priceChangePercent),
    highPrice: Number(t.highPrice),
    lowPrice: Number(t.lowPrice),
    quoteVolume: Number(t.quoteVolume),
  }));
}
