import type { Candle } from "../types.js";

/**
 * Average True Range (ATR) — Wilder's smoothing, default period 14.
 *
 * True Range for each bar is the greatest of:
 *   - high - low
 *   - |high - prevClose|
 *   - |low - prevClose|
 *
 * ATR is seeded with the simple average of the first `period` true ranges, then
 * smoothed: atr = (prevAtr * (period - 1) + tr) / period.
 *
 * @returns Array aligned to `candles`; entries are `null` until the seed bar.
 */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n <= period) return out;

  const tr: number[] = new Array(n).fill(0);
  tr[0] = candles[0]!.high - candles[0]!.low;
  for (let i = 1; i < n; i++) {
    const c = candles[i]!;
    const prevClose = candles[i - 1]!.close;
    tr[i] = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose),
    );
  }

  // Seed ATR at index `period` with the mean of TR[1..period].
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i]!;
  let prev = sum / period;
  out[period] = prev;

  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]!) / period;
    out[i] = prev;
  }

  return out;
}
