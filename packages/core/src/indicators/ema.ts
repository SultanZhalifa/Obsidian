/**
 * Exponential Moving Average (EMA).
 *
 * Weighting factor: k = 2 / (period + 1). The conventional seed for the first
 * EMA value is the SMA of the first `period` samples (this is what TradingView,
 * stockcharts.com and most trading libraries do), after which each value is:
 *
 *   ema[i] = price[i] * k + ema[i - 1] * (1 - k)
 *
 * @param values Source series, oldest first.
 * @param period Smoothing period. Must be a positive integer.
 * @returns Array aligned to `values`; entries before the seed are `null`.
 */
export function ema(values: number[], period: number): (number | null)[] {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error(`ema: period must be a positive integer, received ${period}`);
  }

  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  const k = 2 / (period + 1);

  // Seed with SMA of the first `period` values.
  let seed = 0;
  for (let i = 0; i < period; i++) {
    const v = values[i];
    if (v === undefined || !Number.isFinite(v)) {
      throw new Error(`ema: non-finite value at index ${i}`);
    }
    seed += v;
  }
  let prev = seed / period;
  out[period - 1] = prev;

  for (let i = period; i < values.length; i++) {
    const v = values[i];
    if (v === undefined || !Number.isFinite(v)) {
      throw new Error(`ema: non-finite value at index ${i}`);
    }
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }

  return out;
}
