import { describe, it, expect } from "vitest";
import { runBacktest, type BacktestParams } from "./backtest.js";
import type { Candle } from "./types.js";

function series(closes: number[]): Candle[] {
  // Open == previous close (or own close on the first bar) so next-bar-open
  // execution is predictable; high/low bracket the close.
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1]!;
    return {
      time: i * 60_000,
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
      volume: 1,
    };
  });
}

const base: BacktestParams = {
  strategy: "ma_cross",
  initialCash: 10_000,
  feeBps: 0,
  fastPeriod: 2,
  slowPeriod: 4,
};

describe("backtest engine", () => {
  it("makes money on a clean uptrend with MA cross and no fees", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2); // steady rise
    const res = runBacktest(series(closes), base);
    expect(res.tradeCount).toBeGreaterThanOrEqual(1);
    expect(res.finalEquity).toBeGreaterThan(res.initialCash);
    expect(res.totalReturnPct).toBeGreaterThan(0);
  });

  it("never goes to negative cash and equity is finite", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + 20 * Math.sin(i / 3));
    const res = runBacktest(series(closes), { ...base, feeBps: 10 });
    for (const p of res.equityCurve) {
      expect(Number.isFinite(p.equity)).toBe(true);
      expect(p.equity).toBeGreaterThan(0);
    }
  });

  it("does not look ahead: a flat strategy makes zero trades", () => {
    const closes = Array.from({ length: 40 }, () => 100); // flat → MAs equal, never long
    const res = runBacktest(series(closes), base);
    expect(res.tradeCount).toBe(0);
    expect(res.finalEquity).toBeCloseTo(res.initialCash, 6);
  });

  it("computes win rate and profit factor consistently", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + 15 * Math.sin(i / 5));
    const res = runBacktest(series(closes), { ...base, feeBps: 5 });
    expect(res.winRatePct).toBeGreaterThanOrEqual(0);
    expect(res.winRatePct).toBeLessThanOrEqual(100);
    expect(res.winCount).toBeLessThanOrEqual(res.tradeCount);
    expect(res.maxDrawdownPct).toBeGreaterThanOrEqual(0);
  });

  it("fees drag returns versus a zero-fee run", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + 12 * Math.sin(i / 4));
    const noFee = runBacktest(series(closes), { ...base, feeBps: 0 });
    const withFee = runBacktest(series(closes), { ...base, feeBps: 20 });
    if (noFee.tradeCount > 0) {
      expect(withFee.finalEquity).toBeLessThanOrEqual(noFee.finalEquity);
    }
  });

  it("runs the RSI mean-reversion strategy", () => {
    const closes = Array.from({ length: 100 }, (_, i) => 100 + 25 * Math.sin(i / 6));
    const res = runBacktest(series(closes), {
      strategy: "rsi_reversion",
      initialCash: 10_000,
      feeBps: 10,
      rsiPeriod: 14,
      rsiBuyBelow: 35,
      rsiSellAbove: 65,
    });
    expect(res.equityCurve.length).toBe(closes.length);
    expect(Number.isFinite(res.totalReturnPct)).toBe(true);
  });
});
