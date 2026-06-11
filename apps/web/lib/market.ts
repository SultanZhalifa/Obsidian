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

/**
 * Fetch a deep window of real historical candles by stitching multiple Binance
 * REST pages (max 1000 bars per request), walking backwards from `endTime`.
 * Returns oldest-first, de-duplicated. Used by the backtester so strategies run
 * over real, multi-thousand-bar history rather than the chart's 500-bar paint.
 */
export async function getHistoricalCandles(
  symbol: string,
  timeframe: Timeframe,
  bars: number,
): Promise<Candle[]> {
  const target = Math.min(Math.max(bars, 100), 5000);
  const collected: Candle[] = [];
  let endTime: number | undefined;

  while (collected.length < target) {
    const url = new URL("/api/v3/klines", serverEnv.binanceRest);
    url.searchParams.set("symbol", symbol.toUpperCase());
    url.searchParams.set("interval", timeframe);
    url.searchParams.set("limit", "1000");
    if (endTime) url.searchParams.set("endTime", String(endTime));

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`klines ${symbol} ${timeframe}: ${res.status}`);
    const raw = (await res.json()) as unknown[][];
    if (raw.length === 0) break;

    const page: Candle[] = raw.map((k) => ({
      time: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
    // Prepend older page before what we have.
    collected.unshift(...page);
    // Next request ends just before this page's first bar.
    const first = page[0];
    if (!first) break;
    endTime = first.time - 1;
    if (page.length < 1000) break; // no more history available
  }

  // De-duplicate by open time and sort oldest-first.
  const byTime = new Map<number, Candle>();
  for (const c of collected) byTime.set(c.time, c);
  const sorted = [...byTime.values()].sort((a, b) => a.time - b.time);
  return sorted.slice(-target);
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
  if (symbols.length === 0) return [];
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

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

let exchangeCache: { at: number; symbols: SymbolInfo[] } | null = null;
const EXCHANGE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * The set of currently-tradable USDT spot pairs from Binance exchangeInfo,
 * cached in-process for an hour. Used to power symbol search. Real data.
 */
export async function getTradableSymbols(): Promise<SymbolInfo[]> {
  if (exchangeCache && Date.now() - exchangeCache.at < EXCHANGE_TTL_MS) {
    return exchangeCache.symbols;
  }
  const url = new URL("/api/v3/exchangeInfo", serverEnv.binanceRest);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`exchangeInfo: ${res.status}`);
  const data = (await res.json()) as {
    symbols: {
      symbol: string;
      status: string;
      baseAsset: string;
      quoteAsset: string;
      isSpotTradingAllowed: boolean;
    }[];
  };
  const symbols: SymbolInfo[] = data.symbols
    .filter(
      (s) =>
        s.status === "TRADING" &&
        s.isSpotTradingAllowed &&
        s.quoteAsset === "USDT",
    )
    .map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  exchangeCache = { at: Date.now(), symbols };
  return symbols;
}

/** Filter tradable symbols by a free-text query (matches base asset or pair). */
export async function searchSymbols(query: string, limit = 30): Promise<SymbolInfo[]> {
  const all = await getTradableSymbols();
  const q = query.trim().toUpperCase();
  if (!q) {
    // No query: surface a few common, high-liquidity pairs as suggestions.
    const common = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX"];
    return all
      .filter((s) => common.includes(s.baseAsset))
      .slice(0, limit);
  }
  const starts: SymbolInfo[] = [];
  const contains: SymbolInfo[] = [];
  for (const s of all) {
    if (s.baseAsset.startsWith(q) || s.symbol.startsWith(q)) starts.push(s);
    else if (s.baseAsset.includes(q)) contains.push(s);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
