/**
 * Simple Moving Average (SMA).
 *
 * The arithmetic mean of the last `period` values, computed for every position
 * where a full window is available. Uses an incremental rolling sum so the whole
 * series is O(n) rather than O(n * period).
 *
 * @param values Source series (e.g. closing prices), oldest first.
 * @param period Window length. Must be a positive integer.
 * @returns Array aligned to `values`; the first `period - 1` entries are `null`
 *          because no full window exists yet.
 */
export function sma(values: number[], period: number): (number | null)[] {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error(`sma: period must be a positive integer, received ${period}`);
  }

  const out: (number | null)[] = new Array(values.length).fill(null);
  let windowSum = 0;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === undefined || !Number.isFinite(value)) {
      throw new Error(`sma: non-finite value at index ${i}`);
    }
    windowSum += value;

    if (i >= period) {
      const dropped = values[i - period];
      windowSum -= dropped as number;
    }
    if (i >= period - 1) {
      out[i] = windowSum / period;
    }
  }

  return out;
}
