export { sma } from "./sma.js";
export { ema } from "./ema.js";
export { rsi } from "./rsi.js";
export { macd, type MacdPoint } from "./macd.js";
export { bollinger, type BollingerBand } from "./bollinger.js";
export { stochastic, type StochasticPoint } from "./stochastic.js";
export { atr } from "./atr.js";
export { vwap } from "./vwap.js";

import type { Candle } from "../types.js";

/** Extract the closing-price series from an OHLCV candle array, oldest first. */
export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}
