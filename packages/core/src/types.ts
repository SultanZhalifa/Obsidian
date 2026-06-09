/** A single OHLCV candle. `time` is the open time in epoch milliseconds. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export const TIMEFRAMES: readonly Timeframe[] = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
] as const;

export type OrderSide = "buy" | "sell";

/** Topics carried over the gateway WebSocket fan-out. */
export type StreamTopic =
  | "ticker"
  | "kline"
  | "depth"
  | "trades"
  | "indicators"
  | "alerts";
