import type { Candle } from "../types.js";
import { sma } from "./sma.js";

export interface StochasticPoint {
  /** %K — position of close within the high/low range of the lookback. */
  k: number;
  /** %D — SMA of %K over `smoothD` periods (the signal line). */
  d: number;
}

/**
 * Stochastic Oscillator (%K / %D).
 *
 * Fast %K over `period`:
 *   %K = 100 * (close - lowestLow) / (highestHigh - lowestLow)
 * Then %K is smoothed by `smoothK` (SMA) to get the "slow" %K used here, and %D
 * is the SMA of that over `smoothD`. Defaults 14/3/3 (the common "slow stoch").
 *
 * When the range is zero (flat window) %K is defined as 50 (neutral).
 *
 * @returns Array aligned to `candles`; entries are `null` until enough history.
 */
export function stochastic(
  candles: Candle[],
  period = 14,
  smoothK = 3,
  smoothD = 3,
): (StochasticPoint | null)[] {
  const n = candles.length;
  const out: (StochasticPoint | null)[] = new Array(n).fill(null);
  if (n < period) return out;

  // Raw fast %K.
  const rawK: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j]!;
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    }
    const close = candles[i]!.close;
    const range = hi - lo;
    rawK[i] = range === 0 ? 50 : (100 * (close - lo)) / range;
  }

  // Slow %K = SMA(rawK, smoothK); %D = SMA(slowK, smoothD). Run SMA only over the
  // contiguous defined tail so alignment is preserved.
  const firstK = rawK.findIndex((v) => v !== null);
  if (firstK === -1) return out;
  const definedK = rawK.slice(firstK) as number[];

  const slowK = sma(definedK, smoothK);
  const slowKFull: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < slowK.length; i++) slowKFull[firstK + i] = slowK[i] ?? null;

  const firstSlow = slowKFull.findIndex((v) => v !== null);
  if (firstSlow === -1) return out;
  const definedSlow = slowKFull.slice(firstSlow) as number[];
  const dLine = sma(definedSlow, smoothD);

  for (let i = 0; i < dLine.length; i++) {
    const dVal = dLine[i];
    const kVal = slowKFull[firstSlow + i];
    if (dVal == null || kVal == null) continue;
    out[firstSlow + i] = { k: kVal, d: dVal };
  }

  return out;
}
