import { describe, it, expect } from "vitest";
import { stochastic } from "./stochastic.js";
import { atr } from "./atr.js";
import { vwap } from "./vwap.js";
import type { Candle } from "../types.js";

function candle(
  high: number,
  low: number,
  close: number,
  open = close,
  volume = 1,
  time = 0,
): Candle {
  return { time, open, high, low, close, volume };
}

describe("stochastic", () => {
  it("%K is 100 at the top of the range and 0 at the bottom", () => {
    // 14 bars climbing, last close == highest high → %K near 100.
    const up: Candle[] = Array.from({ length: 20 }, (_, i) =>
      candle(10 + i, 8 + i, 10 + i),
    );
    const out = stochastic(up, 14, 1, 1); // no smoothing → raw %K
    const last = out[out.length - 1]!;
    expect(last).not.toBeNull();
    expect(last.k).toBeCloseTo(100, 6);

    const down: Candle[] = Array.from({ length: 20 }, (_, i) =>
      candle(30 - i, 28 - i, 28 - i),
    );
    const outD = stochastic(down, 14, 1, 1);
    const lastD = outD[outD.length - 1]!;
    expect(lastD.k).toBeCloseTo(0, 6);
  });

  it("returns 50 for a perfectly flat window", () => {
    const flat: Candle[] = Array.from({ length: 20 }, () => candle(10, 10, 10));
    const out = stochastic(flat, 14, 1, 1);
    expect(out[out.length - 1]!.k).toBeCloseTo(50, 6);
  });

  it("keeps %K and %D within [0,100]", () => {
    const data: Candle[] = Array.from({ length: 60 }, (_, i) => {
      const base = 100 + 10 * Math.sin(i / 4);
      return candle(base + 2, base - 2, base);
    });
    const out = stochastic(data).filter((p): p is NonNullable<typeof p> => p !== null);
    for (const p of out) {
      expect(p.k).toBeGreaterThanOrEqual(0);
      expect(p.k).toBeLessThanOrEqual(100);
      expect(p.d).toBeGreaterThanOrEqual(0);
      expect(p.d).toBeLessThanOrEqual(100);
    }
  });
});

describe("atr", () => {
  it("equals the constant true range for a steady series", () => {
    // Each bar: high-low = 2, no gaps → every TR = 2 → ATR = 2.
    const data: Candle[] = Array.from({ length: 30 }, (_, i) =>
      candle(101, 99, 100, 100, 1, i),
    );
    const out = atr(data, 14);
    expect(out[14]).toBeCloseTo(2, 9);
    expect(out[out.length - 1]).toBeCloseTo(2, 9);
  });

  it("accounts for gaps via the prev-close terms", () => {
    // A gap up makes |high - prevClose| the dominant true range.
    const data: Candle[] = [
      candle(10, 9, 10),
      candle(11, 10, 11),
      candle(20, 19, 20), // big gap from prevClose 11
      ...Array.from({ length: 20 }, () => candle(20.5, 19.5, 20)),
    ];
    const out = atr(data, 5);
    const defined = out.filter((v): v is number => v !== null);
    expect(defined.length).toBeGreaterThan(0);
    for (const v of defined) expect(v).toBeGreaterThan(0);
  });
});

describe("vwap", () => {
  it("equals the typical price when volume is uniform and price constant", () => {
    const data: Candle[] = Array.from({ length: 5 }, () =>
      candle(12, 8, 10, 10, 100, 0),
    );
    const out = vwap(data, false);
    // typical = (12+8+10)/3 = 10 → vwap stays 10.
    expect(out[out.length - 1]).toBeCloseTo(10, 9);
  });

  it("weights higher-volume bars more", () => {
    const data: Candle[] = [
      candle(10, 10, 10, 10, 1), // typical 10, vol 1
      candle(20, 20, 20, 20, 99), // typical 20, vol 99
    ];
    const out = vwap(data, false);
    // (10*1 + 20*99) / (1 + 99) = 19.9
    expect(out[1]).toBeCloseTo(19.9, 9);
  });

  it("resets at UTC day boundaries when sessionReset is on", () => {
    const dayMs = 86_400_000;
    const data: Candle[] = [
      candle(10, 10, 10, 10, 1, 0), // day 0
      candle(30, 30, 30, 30, 1, 1000), // day 0 → vwap = 20
      candle(50, 50, 50, 50, 1, dayMs), // day 1 → resets, vwap = 50
    ];
    const out = vwap(data, true);
    expect(out[1]).toBeCloseTo(20, 9);
    expect(out[2]).toBeCloseTo(50, 9);
  });
});
