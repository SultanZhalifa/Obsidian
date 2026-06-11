import type { Candle } from "./types.js";
import { rsi } from "./indicators/rsi.js";
import { macd } from "./indicators/macd.js";
import { sma } from "./indicators/sma.js";

/**
 * Deterministic, long-only backtesting engine.
 *
 * A strategy emits a desired position state per bar (flat or long). The engine
 * walks the candle series and, when the target state changes, executes the
 * trade at the NEXT bar's open price — this avoids look-ahead bias (you cannot
 * trade on a bar using information only known at its close). A configurable
 * per-trade fee (in basis points of notional) is applied to each fill.
 *
 * The result reports an equity curve, the list of round-trip trades, and the
 * standard performance statistics. All amounts are in quote currency.
 */

export type StrategyId = "rsi_reversion" | "ma_cross" | "macd_cross";

export interface BacktestParams {
  strategy: StrategyId;
  /** Starting cash. */
  initialCash: number;
  /** Per-fill fee in basis points of notional (10 = 0.10%). */
  feeBps: number;
  // Strategy knobs (only the relevant ones are read per strategy).
  rsiPeriod?: number;
  rsiBuyBelow?: number;
  rsiSellAbove?: number;
  fastPeriod?: number;
  slowPeriod?: number;
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  /** Net P&L for this round trip after fees. */
  pnl: number;
  returnPct: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  initialCash: number;
  finalEquity: number;
  totalReturnPct: number;
  /** Number of closed round-trip trades. */
  tradeCount: number;
  winCount: number;
  winRatePct: number;
  /** Largest peak-to-trough drop in equity, as a positive percentage. */
  maxDrawdownPct: number;
  /** Sum of wins / absolute sum of losses (Infinity if no losses). */
  profitFactor: number;
  /** Average P&L per trade. */
  avgTradePnl: number;
}

/**
 * Produce the target position per bar (1 = long, 0 = flat) for a strategy.
 * `null` entries mean "no opinion yet" (indicator not warmed up) and are
 * treated as flat.
 */
function targetStates(candles: Candle[], p: BacktestParams): (0 | 1)[] {
  const n = candles.length;
  const closes = candles.map((c) => c.close);
  const states: (0 | 1)[] = new Array(n).fill(0);

  if (p.strategy === "rsi_reversion") {
    const period = p.rsiPeriod ?? 14;
    const buyBelow = p.rsiBuyBelow ?? 30;
    const sellAbove = p.rsiSellAbove ?? 70;
    const r = rsi(closes, period);
    let inPos: 0 | 1 = 0;
    for (let i = 0; i < n; i++) {
      const v = r[i];
      if (v == null) {
        states[i] = inPos;
        continue;
      }
      if (inPos === 0 && v < buyBelow) inPos = 1;
      else if (inPos === 1 && v > sellAbove) inPos = 0;
      states[i] = inPos;
    }
    return states;
  }

  if (p.strategy === "ma_cross") {
    const fast = sma(closes, p.fastPeriod ?? 20);
    const slow = sma(closes, p.slowPeriod ?? 50);
    for (let i = 0; i < n; i++) {
      const f = fast[i];
      const s = slow[i];
      states[i] = f != null && s != null && f > s ? 1 : 0;
    }
    return states;
  }

  // macd_cross: long while the MACD line is above its signal line.
  const m = macd(closes, p.fastPeriod ?? 12, p.slowPeriod ?? 26, 9);
  for (let i = 0; i < n; i++) {
    const point = m[i];
    states[i] = point && point.macd > point.signal ? 1 : 0;
  }
  return states;
}

export function runBacktest(
  candles: Candle[],
  params: BacktestParams,
): BacktestResult {
  const n = candles.length;
  const feeRate = params.feeBps / 10_000;

  const states = targetStates(candles, params);

  let cash = params.initialCash;
  let positionQty = 0;
  let entryPrice = 0;
  let entryTime = 0;

  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];

  // Execute state changes at the NEXT bar's open. We therefore look at the
  // target state decided on bar i-1 and act on bar i.
  for (let i = 0; i < n; i++) {
    const bar = candles[i]!;
    const desired = i > 0 ? states[i - 1]! : 0;

    if (desired === 1 && positionQty === 0) {
      // Enter long at this bar's open with all available cash.
      const price = bar.open;
      const grossQty = cash / price;
      // Account for the entry fee so we don't go negative.
      const qty = grossQty / (1 + feeRate);
      const cost = qty * price;
      const fee = cost * feeRate;
      cash -= cost + fee;
      positionQty = qty;
      entryPrice = price;
      entryTime = bar.time;
    } else if (desired === 0 && positionQty > 0) {
      // Exit at this bar's open.
      const price = bar.open;
      const proceeds = positionQty * price;
      const fee = proceeds * feeRate;
      cash += proceeds - fee;

      const entryCost = positionQty * entryPrice;
      const pnl = proceeds - fee - entryCost - entryCost * feeRate;
      trades.push({
        entryTime,
        exitTime: bar.time,
        entryPrice,
        exitPrice: price,
        quantity: positionQty,
        pnl,
        returnPct: (pnl / entryCost) * 100,
      });
      positionQty = 0;
    }

    // Mark-to-market equity at this bar's close.
    const equity = cash + positionQty * bar.close;
    equityCurve.push({ time: bar.time, equity });
  }

  // Close any open position at the final close so stats are complete.
  if (positionQty > 0 && n > 0) {
    const last = candles[n - 1]!;
    const price = last.close;
    const proceeds = positionQty * price;
    const fee = proceeds * feeRate;
    cash += proceeds - fee;
    const entryCost = positionQty * entryPrice;
    const pnl = proceeds - fee - entryCost - entryCost * feeRate;
    trades.push({
      entryTime,
      exitTime: last.time,
      entryPrice,
      exitPrice: price,
      quantity: positionQty,
      pnl,
      returnPct: (pnl / entryCost) * 100,
    });
    positionQty = 0;
    const lastPoint = equityCurve[equityCurve.length - 1];
    if (lastPoint) lastPoint.equity = cash;
  }

  return summarize(trades, equityCurve, params.initialCash, cash);
}

function summarize(
  trades: BacktestTrade[],
  equityCurve: EquityPoint[],
  initialCash: number,
  finalCash: number,
): BacktestResult {
  const wins = trades.filter((t) => t.pnl > 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = trades
    .filter((t) => t.pnl < 0)
    .reduce((s, t) => s + Math.abs(t.pnl), 0);

  // Max drawdown over the equity curve.
  let peak = -Infinity;
  let maxDd = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    if (peak > 0) {
      const dd = (peak - point.equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);

  return {
    trades,
    equityCurve,
    initialCash,
    finalEquity: finalCash,
    totalReturnPct: ((finalCash - initialCash) / initialCash) * 100,
    tradeCount: trades.length,
    winCount: wins.length,
    winRatePct: trades.length ? (wins.length / trades.length) * 100 : 0,
    maxDrawdownPct: maxDd * 100,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss,
    avgTradePnl: trades.length ? totalPnl / trades.length : 0,
  };
}
