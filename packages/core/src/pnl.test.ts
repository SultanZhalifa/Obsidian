import { describe, it, expect } from "vitest";
import {
  emptyPosition,
  applyFill,
  applyFills,
  unrealizedPnl,
  totalPnl,
  notional,
} from "./pnl.js";

describe("paper-trading P&L", () => {
  it("opens a long and tracks unrealized P&L", () => {
    const p = applyFill(emptyPosition(), { side: "buy", quantity: 2, price: 100 });
    expect(p.quantity).toBe(2);
    expect(p.avgPrice).toBe(100);
    expect(p.realizedPnl).toBe(0);
    expect(unrealizedPnl(p, 110)).toBeCloseTo(20, 9); // (110-100)*2
    expect(notional(p, 110)).toBeCloseTo(220, 9);
  });

  it("re-weights average price when adding to a long", () => {
    const p = applyFills(emptyPosition(), [
      { side: "buy", quantity: 1, price: 100 },
      { side: "buy", quantity: 3, price: 200 },
    ]);
    expect(p.quantity).toBe(4);
    // (1*100 + 3*200) / 4 = 175
    expect(p.avgPrice).toBeCloseTo(175, 9);
  });

  it("realizes P&L on a partial close and keeps avg price", () => {
    const p = applyFills(emptyPosition(), [
      { side: "buy", quantity: 4, price: 100 },
      { side: "sell", quantity: 1, price: 130 },
    ]);
    expect(p.quantity).toBe(3);
    expect(p.avgPrice).toBeCloseTo(100, 9);
    expect(p.realizedPnl).toBeCloseTo(30, 9); // (130-100)*1
  });

  it("closes flat and zeroes the average", () => {
    const p = applyFills(emptyPosition(), [
      { side: "buy", quantity: 2, price: 100 },
      { side: "sell", quantity: 2, price: 120 },
    ]);
    expect(p.quantity).toBe(0);
    expect(p.avgPrice).toBe(0);
    expect(p.realizedPnl).toBeCloseTo(40, 9); // (120-100)*2
    expect(unrealizedPnl(p, 999)).toBe(0);
  });

  it("flips from long to short, realizing on the closed quantity", () => {
    const p = applyFills(emptyPosition(), [
      { side: "buy", quantity: 2, price: 100 },
      { side: "sell", quantity: 5, price: 120 }, // close 2 @120, open 3 short @120
    ]);
    expect(p.quantity).toBe(-3);
    expect(p.avgPrice).toBeCloseTo(120, 9);
    expect(p.realizedPnl).toBeCloseTo(40, 9); // (120-100)*2
    // short: profits when price falls
    expect(unrealizedPnl(p, 110)).toBeCloseTo(30, 9); // (110-120)*-3
  });

  it("profits on a short when the price falls", () => {
    const p = applyFill(emptyPosition(), { side: "sell", quantity: 2, price: 100 });
    expect(p.quantity).toBe(-2);
    expect(unrealizedPnl(p, 90)).toBeCloseTo(20, 9); // (90-100)*-2
    const closed = applyFill(p, { side: "buy", quantity: 2, price: 90 });
    expect(closed.quantity).toBe(0);
    expect(closed.realizedPnl).toBeCloseTo(20, 9);
  });

  it("subtracts fees from realized P&L immediately", () => {
    const p = applyFills(emptyPosition(), [
      { side: "buy", quantity: 1, price: 100, fee: 0.5 },
      { side: "sell", quantity: 1, price: 110, fee: 0.5 },
    ]);
    expect(p.realizedPnl).toBeCloseTo(10 - 1, 9); // (110-100) - 1 in fees
  });

  it("totalPnl combines realized and unrealized", () => {
    const p = applyFills(emptyPosition(), [
      { side: "buy", quantity: 2, price: 100 },
      { side: "sell", quantity: 1, price: 120 }, // realized 20, holds 1 @100
    ]);
    expect(totalPnl(p, 130)).toBeCloseTo(20 + 30, 9); // realized 20 + (130-100)*1
  });

  it("rejects invalid fills", () => {
    expect(() => applyFill(emptyPosition(), { side: "buy", quantity: 0, price: 100 })).toThrow();
    expect(() => applyFill(emptyPosition(), { side: "buy", quantity: 1, price: 0 })).toThrow();
  });
});
