import type { Candle, Timeframe } from "@obsidian/core";

const MAX_CANDLES = 600;

function key(symbol: string, tf: Timeframe): string {
  return `${symbol}:${tf}`;
}

/**
 * In-memory rolling store of closed candles per symbol/timeframe. Bounded to
 * MAX_CANDLES so indicator windows always have enough history without growing
 * unbounded. Seeded from REST backfill, then kept current from the live stream.
 */
export class MarketState {
  private readonly candles = new Map<string, Candle[]>();
  private readonly lastPrice = new Map<string, number>();

  seed(symbol: string, tf: Timeframe, candles: Candle[]): void {
    this.candles.set(key(symbol, tf), candles.slice(-MAX_CANDLES));
    const last = candles[candles.length - 1];
    if (last) this.lastPrice.set(symbol, last.close);
  }

  /**
   * Update with a candle from the live stream. If the candle's open time
   * matches the last stored candle, it replaces it (in-progress update);
   * otherwise it is appended (new bar). Returns the current series.
   */
  upsert(symbol: string, tf: Timeframe, candle: Candle): Candle[] {
    const k = key(symbol, tf);
    const series = this.candles.get(k) ?? [];
    const last = series[series.length - 1];
    if (last && last.time === candle.time) {
      series[series.length - 1] = candle;
    } else {
      series.push(candle);
      if (series.length > MAX_CANDLES) series.shift();
    }
    this.candles.set(k, series);
    this.lastPrice.set(symbol, candle.close);
    return series;
  }

  getCandles(symbol: string, tf: Timeframe): Candle[] {
    return this.candles.get(key(symbol, tf)) ?? [];
  }

  setLastPrice(symbol: string, price: number): void {
    this.lastPrice.set(symbol, price);
  }

  getLastPrice(symbol: string): number | undefined {
    return this.lastPrice.get(symbol);
  }
}
