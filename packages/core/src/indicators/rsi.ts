/**
 * Relative Strength Index (RSI) — Wilder's smoothing method.
 *
 * Steps (classic Wilder, period typically 14):
 *  1. Compute period-over-period changes.
 *  2. Seed average gain/loss with the simple mean of the first `period` changes.
 *  3. Smooth subsequently: avg = (prevAvg * (period - 1) + current) / period.
 *  4. RS = avgGain / avgLoss;  RSI = 100 - 100 / (1 + RS).
 *
 * Edge case: when avgLoss is 0 the asset only rose over the window, so RSI = 100.
 *
 * @param values Closing prices, oldest first.
 * @param period Lookback period. Must be a positive integer.
 * @returns Array aligned to `values`; the first `period` entries are `null`.
 */
export function rsi(values: number[], period = 14): (number | null)[] {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error(`rsi: period must be a positive integer, received ${period}`);
  }

  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;

  // Seed averages from the first `period` changes (indices 1..period).
  for (let i = 1; i <= period; i++) {
    const cur = values[i];
    const prev = values[i - 1];
    if (cur === undefined || prev === undefined) break;
    const change = cur - prev;
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const cur = values[i];
    const prev = values[i - 1];
    if (cur === undefined || prev === undefined) break;
    const change = cur - prev;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAverages(avgGain, avgLoss);
  }

  return out;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
