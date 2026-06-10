import WebSocket from "ws";
import type { Candle, Timeframe } from "@obsidian/core";
import { config } from "./config.js";
import { logger } from "./logger.js";

/**
 * Fetch historical candles from Binance's public REST endpoint.
 * Real data, no API key required. Returns oldest-first.
 */
export async function fetchKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = config.backfillLimit,
): Promise<Candle[]> {
  const url = new URL("/api/v3/klines", config.binanceRest);
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("interval", timeframe);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(
      `Binance klines ${symbol} ${timeframe} failed: ${res.status} ${res.statusText}`,
    );
  }
  // Each entry: [openTime, open, high, low, close, volume, closeTime, ...]
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

export interface BinanceEvents {
  onTrade(symbol: string, price: number, qty: number, buyerMaker: boolean, at: number): void;
  onKline(symbol: string, timeframe: Timeframe, candle: Candle, closed: boolean): void;
  onDepth(symbol: string, bids: [number, number][], asks: [number, number][], at: number): void;
  onTicker(
    symbol: string,
    price: number,
    changePct: number,
    high: number,
    low: number,
    volume: number,
    at: number,
  ): void;
  onStatusChange(connected: boolean): void;
}

/**
 * Maintains one upstream WebSocket to Binance for the configured symbols and
 * timeframes, with exponential-backoff reconnect. Parses combined-stream
 * messages and dispatches typed events. This is the single durable upstream
 * connection the rest of the system fans out from.
 */
export class BinanceStream {
  private ws: WebSocket | null = null;
  private backoffMs = 1000;
  private readonly maxBackoffMs = 30_000;
  private closedByUser = false;
  private pingTimer: NodeJS.Timeout | null = null;
  private readonly symbols: Set<string>;
  private controlId = 1;

  constructor(
    symbols: string[],
    private readonly timeframes: Timeframe[],
    private readonly events: BinanceEvents,
  ) {
    this.symbols = new Set(symbols.map((s) => s.toLowerCase()));
  }

  /** All stream names for one symbol (trade, depth, ticker, every timeframe). */
  private streamsForSymbol(s: string): string[] {
    const sym = s.toLowerCase();
    return [
      `${sym}@trade`,
      `${sym}@depth20@100ms`,
      `${sym}@ticker`,
      ...this.timeframes.map((tf) => `${sym}@kline_${tf}`),
    ];
  }

  private buildStreamNames(): string[] {
    const streams: string[] = [];
    for (const s of this.symbols) streams.push(...this.streamsForSymbol(s));
    return streams;
  }

  /** Has the gateway already opened upstream streams for this symbol? */
  hasSymbol(symbol: string): boolean {
    return this.symbols.has(symbol.toLowerCase());
  }

  /**
   * Begin streaming a symbol that isn't already tracked. Sends a Binance WS
   * SUBSCRIBE control frame if connected; otherwise the symbol is picked up on
   * the next (re)connect since it's now in the set.
   */
  addSymbol(symbol: string): void {
    const sym = symbol.toLowerCase();
    if (this.symbols.has(sym)) return;
    this.symbols.add(sym);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: this.streamsForSymbol(sym),
          id: this.controlId++,
        }),
      );
      logger.info({ symbol: sym }, "dynamically subscribed symbol");
    }
  }

  /** Stop streaming a symbol (UNSUBSCRIBE control frame) and forget it. */
  removeSymbol(symbol: string): void {
    const sym = symbol.toLowerCase();
    if (!this.symbols.has(sym)) return;
    this.symbols.delete(sym);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: "UNSUBSCRIBE",
          params: this.streamsForSymbol(sym),
          id: this.controlId++,
        }),
      );
      logger.info({ symbol: sym }, "dynamically unsubscribed symbol");
    }
  }

  start(): void {
    this.closedByUser = false;
    this.connect();
  }

  private connect(): void {
    const streams = this.buildStreamNames().join("/");
    const url = `${config.binanceWs}/stream?streams=${streams}`;
    logger.info({ symbols: this.symbols, timeframes: this.timeframes }, "connecting to Binance");

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", () => {
      this.backoffMs = 1000;
      this.events.onStatusChange(true);
      logger.info("Binance stream connected");
      // Binance requires a pong within 1 minute; ws library auto-pongs, but we
      // also send periodic pings to detect dead connections promptly.
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, 30_000);
    });

    ws.on("message", (data) => this.handleMessage(data));

    ws.on("error", (err) => {
      logger.error({ err: err.message }, "Binance stream error");
    });

    ws.on("close", () => {
      this.events.onStatusChange(false);
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.closedByUser) return;
      logger.warn({ backoffMs: this.backoffMs }, "Binance stream closed, reconnecting");
      setTimeout(() => this.connect(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
    });
  }

  private handleMessage(data: WebSocket.RawData): void {
    let parsed: { stream?: string; data?: Record<string, unknown> };
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }
    const payload = parsed.data;
    const stream = parsed.stream;
    if (!payload || !stream) return;

    const eventType = payload.e as string | undefined;

    if (eventType === "trade") {
      const symbol = (payload.s as string).toLowerCase();
      this.events.onTrade(
        symbol,
        Number(payload.p),
        Number(payload.q),
        Boolean(payload.m),
        Number(payload.T),
      );
      return;
    }

    if (eventType === "kline") {
      const symbol = (payload.s as string).toLowerCase();
      const k = payload.k as Record<string, unknown>;
      const timeframe = String(k.i) as Timeframe;
      const candle: Candle = {
        time: Number(k.t),
        open: Number(k.o),
        high: Number(k.h),
        low: Number(k.l),
        close: Number(k.c),
        volume: Number(k.v),
      };
      this.events.onKline(symbol, timeframe, candle, Boolean(k.x));
      return;
    }

    if (eventType === "24hrTicker") {
      const symbol = (payload.s as string).toLowerCase();
      this.events.onTicker(
        symbol,
        Number(payload.c),
        Number(payload.P),
        Number(payload.h),
        Number(payload.l),
        Number(payload.v),
        Number(payload.E),
      );
      return;
    }

    // Partial depth stream (depth20) has no event type; detect by shape.
    if (Array.isArray(payload.bids) && Array.isArray(payload.asks)) {
      // stream name is like "btcusdt@depth20@100ms"
      const symbol = stream.split("@")[0] ?? "";
      const bids = (payload.bids as [string, string][]).map(
        ([p, q]) => [Number(p), Number(q)] as [number, number],
      );
      const asks = (payload.asks as [string, string][]).map(
        ([p, q]) => [Number(p), Number(q)] as [number, number],
      );
      this.events.onDepth(symbol, bids, asks, Date.now());
    }
  }

  stop(): void {
    this.closedByUser = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
  }
}
