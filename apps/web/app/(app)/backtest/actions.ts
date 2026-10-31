"use server";

import {
  backtestRequestSchema,
  runBacktest,
  type BacktestResult,
  type Timeframe,
} from "@obsidian/core";
import { getCurrentUser } from "@/lib/auth";
import { getHistoricalCandles } from "@/lib/market";
import { assertSameOrigin, clientIp, rateLimit } from "@/lib/security";
import { audit } from "@/lib/audit";

export interface BacktestActionResult {
  ok: boolean;
  error?: string;
  result?: BacktestResult;
  meta?: { symbol: string; timeframe: string; bars: number; strategy: string };
}

export async function runBacktestAction(
  input: unknown,
): Promise<BacktestActionResult> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  // Backtests are comparatively heavy (multi-page REST fetch + compute), so a
  // tighter limit than ordinary actions.
  const limit = rateLimit(`backtest:${user.id}`, 10, 0.1);
  if (!limit.allowed) {
    return { ok: false, error: "Too many backtests. Please wait a moment." };
  }

  const parsed = backtestRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const req = parsed.data;

  let candles;
  try {
    candles = await getHistoricalCandles(
      req.symbol,
      req.timeframe as Timeframe,
      req.bars,
    );
  } catch {
    return { ok: false, error: "Couldn't load historical data. Try again." };
  }
  if (candles.length < 50) {
    return { ok: false, error: "Not enough historical data for this market." };
  }

  const result = runBacktest(candles, {
    strategy: req.strategy,
    initialCash: req.initialCash,
    feeBps: req.feeBps,
    rsiPeriod: req.rsiPeriod,
    rsiBuyBelow: req.rsiBuyBelow,
    rsiSellAbove: req.rsiSellAbove,
    fastPeriod: req.fastPeriod,
    slowPeriod: req.slowPeriod,
  });

  await audit(
    user.id,
    "backtest.run",
    {
      symbol: req.symbol,
      timeframe: req.timeframe,
      strategy: req.strategy,
      bars: candles.length,
      totalReturnPct: Number(result.totalReturnPct.toFixed(2)),
    },
    (await clientIp()) ?? undefined,
  );

  return {
    ok: true,
    result,
    meta: {
      symbol: req.symbol,
      timeframe: req.timeframe,
      bars: candles.length,
      strategy: req.strategy,
    },
  };
}
