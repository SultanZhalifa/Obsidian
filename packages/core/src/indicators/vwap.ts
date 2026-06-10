import type { Candle } from "../types.js";

/**
 * Volume-Weighted Average Price (VWAP).
 *
 * Uses the typical price ((high + low + close) / 3) weighted by volume, summed
 * cumulatively. By default it anchors per UTC day — i.e. the running sums reset
 * at each midnight-UTC boundary, matching how exchanges show session VWAP.
 * Pass `sessionReset = false` for a single cumulative VWAP across the whole
 * series.
 *
 * @returns Array aligned to `candles`. The first bar of each session equals its
 *          own typical price; entries are `null` only if volume is zero so far.
 */
export function vwap(
  candles: Candle[],
  sessionReset = true,
): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);

  let cumPV = 0;
  let cumVol = 0;
  let currentDay: number | null = null;

  for (let i = 0; i < n; i++) {
    const c = candles[i]!;
    if (sessionReset) {
      const day = Math.floor(c.time / 86_400_000); // UTC day index
      if (currentDay === null || day !== currentDay) {
        currentDay = day;
        cumPV = 0;
        cumVol = 0;
      }
    }
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumVol += c.volume;
    out[i] = cumVol > 0 ? cumPV / cumVol : null;
  }

  return out;
}
