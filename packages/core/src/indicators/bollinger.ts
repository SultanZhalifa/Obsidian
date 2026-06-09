import { sma } from "./sma.js";

export interface BollingerBand {
  middle: number;
  upper: number;
  lower: number;
  /** Population standard deviation of the window. */
  stdDev: number;
}

/**
 * Bollinger Bands.
 *
 * Middle band = SMA(period).
 * Upper/lower = middle ± multiplier * populationStdDev(window).
 *
 * Standard deviation uses the population formula (divide by N), which is the
 * convention used by Bollinger's original definition and most charting tools.
 *
 * @param values Source series, oldest first.
 * @param period Window length (default 20).
 * @param multiplier Band width in standard deviations (default 2).
 * @returns Array aligned to `values`; entries before the first full window are `null`.
 */
export function bollinger(
  values: number[],
  period = 20,
  multiplier = 2,
): (BollingerBand | null)[] {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error(`bollinger: period must be a positive integer, received ${period}`);
  }

  const middle = sma(values, period);
  const out: (BollingerBand | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i];
    if (mean == null) continue;

    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j] as number;
      const diff = v - mean;
      sumSq += diff * diff;
    }
    const variance = sumSq / period;
    const stdDev = Math.sqrt(variance);

    out[i] = {
      middle: mean,
      upper: mean + multiplier * stdDev,
      lower: mean - multiplier * stdDev,
      stdDev,
    };
  }

  return out;
}
