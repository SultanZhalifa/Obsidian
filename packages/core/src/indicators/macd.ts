import { ema } from "./ema.js";

export interface MacdPoint {
  /** Fast EMA minus slow EMA. */
  macd: number;
  /** EMA of the MACD line over `signalPeriod`. */
  signal: number;
  /** macd - signal. */
  histogram: number;
}

/**
 * Moving Average Convergence Divergence (MACD).
 *
 * MACD line   = EMA(fast) - EMA(slow)        (defaults 12, 26)
 * Signal line = EMA(MACD line, signalPeriod) (default 9)
 * Histogram   = MACD line - Signal line
 *
 * The signal EMA is seeded from the SMA of the first `signalPeriod` defined
 * MACD values, matching the convention in `ema()`. Output entries are `null`
 * until both the slow EMA and the signal EMA are defined.
 *
 * @returns Array aligned to `values` of `MacdPoint | null`.
 */
export function macd(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): (MacdPoint | null)[] {
  if (fastPeriod >= slowPeriod) {
    throw new Error(
      `macd: fastPeriod (${fastPeriod}) must be < slowPeriod (${slowPeriod})`,
    );
  }

  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);

  // MACD line is defined only where both EMAs exist (i.e. from slowPeriod-1 on).
  const macdLine: (number | null)[] = values.map((_, i) => {
    const f = fast[i];
    const s = slow[i];
    if (f == null || s == null) return null;
    return f - s;
  });

  // Run the signal EMA only over the contiguous defined tail of the MACD line.
  const firstDefined = macdLine.findIndex((v) => v !== null);
  const out: (MacdPoint | null)[] = new Array(values.length).fill(null);
  if (firstDefined === -1) return out;

  const definedMacd = macdLine.slice(firstDefined) as number[];
  const signal = ema(definedMacd, signalPeriod);

  for (let j = 0; j < definedMacd.length; j++) {
    const sig = signal[j];
    if (sig == null) continue;
    const m = definedMacd[j] as number;
    out[firstDefined + j] = {
      macd: m,
      signal: sig,
      histogram: m - sig,
    };
  }

  return out;
}
