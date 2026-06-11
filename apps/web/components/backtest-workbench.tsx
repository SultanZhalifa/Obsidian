"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import type { BacktestResult, StrategyId, Timeframe } from "@obsidian/core";
import { TIMEFRAMES } from "@obsidian/core";
import { Panel, Stat, signClass, EmptyState } from "./ui";
import { EquityCurve } from "./equity-curve";
import { IconBacktest, IconWarning } from "./icons";
import {
  prettySymbol,
  formatUsd,
  formatSignedUsd,
  formatPct,
  formatPrice,
  formatNumber,
  formatDateTime,
} from "@/lib/format";
import { runBacktestAction } from "@/app/(app)/backtest/actions";

const STRATEGIES: { value: StrategyId; label: string; blurb: string }[] = [
  {
    value: "rsi_reversion",
    label: "RSI mean-reversion",
    blurb: "Buy when RSI drops below the buy level, exit when it rises above the sell level.",
  },
  {
    value: "ma_cross",
    label: "MA cross",
    blurb: "Long while the fast SMA is above the slow SMA, flat otherwise.",
  },
  {
    value: "macd_cross",
    label: "MACD cross",
    blurb: "Long while the MACD line is above its signal line, flat otherwise.",
  },
];

interface Meta {
  symbol: string;
  timeframe: string;
  bars: number;
  strategy: string;
}

export function BacktestWorkbench({ symbols }: { symbols: string[] }) {
  const [symbol, setSymbol] = useState(symbols[0] ?? "BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [strategy, setStrategy] = useState<StrategyId>("rsi_reversion");
  const [bars, setBars] = useState("2000");
  const [feeBps, setFeeBps] = useState("10");
  // RSI params
  const [rsiPeriod, setRsiPeriod] = useState("14");
  const [rsiBuyBelow, setRsiBuyBelow] = useState("30");
  const [rsiSellAbove, setRsiSellAbove] = useState("70");
  // MA / MACD params
  const [fastPeriod, setFastPeriod] = useState("20");
  const [slowPeriod, setSlowPeriod] = useState("50");

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  const strategyInfo = STRATEGIES.find((s) => s.value === strategy)!;
  const isRsi = strategy === "rsi_reversion";

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await runBacktestAction({
        symbol,
        timeframe,
        strategy,
        bars: Number(bars),
        initialCash: 10_000,
        feeBps: Number(feeBps),
        rsiPeriod: isRsi ? Number(rsiPeriod) : undefined,
        rsiBuyBelow: isRsi ? Number(rsiBuyBelow) : undefined,
        rsiSellAbove: isRsi ? Number(rsiSellAbove) : undefined,
        fastPeriod: !isRsi ? Number(fastPeriod) : undefined,
        slowPeriod: !isRsi ? Number(slowPeriod) : undefined,
      });
      if (!res.ok || !res.result) {
        setError(res.error ?? "Backtest failed.");
        return;
      }
      setResult(res.result);
      setMeta(res.meta ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg-0">Backtest</h1>
        <p className="text-sm text-fg-1">
          Run a strategy over real Binance history. Fills execute at the next
          bar&apos;s open (no look-ahead) with a configurable fee.
        </p>
      </div>

      <Panel title="Strategy">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="bt-symbol">Market</label>
            <select
              id="bt-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="input"
            >
              {symbols.map((s) => (
                <option key={s} value={s}>{prettySymbol(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bt-tf">Timeframe</label>
            <select
              id="bt-tf"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="input"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bt-strategy">Strategy</label>
            <select
              id="bt-strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyId)}
              className="input"
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bt-bars">History (bars)</label>
            <input
              id="bt-bars"
              type="number"
              min={100}
              max={5000}
              value={bars}
              onChange={(e) => setBars(e.target.value)}
              className="input tabular"
            />
          </div>

          {isRsi ? (
            <>
              <div>
                <label className="label" htmlFor="bt-rsi-period">RSI period</label>
                <input id="bt-rsi-period" type="number" min={2} max={100} value={rsiPeriod} onChange={(e) => setRsiPeriod(e.target.value)} className="input tabular" />
              </div>
              <div>
                <label className="label" htmlFor="bt-rsi-buy">Buy below</label>
                <input id="bt-rsi-buy" type="number" min={1} max={99} value={rsiBuyBelow} onChange={(e) => setRsiBuyBelow(e.target.value)} className="input tabular" />
              </div>
              <div>
                <label className="label" htmlFor="bt-rsi-sell">Sell above</label>
                <input id="bt-rsi-sell" type="number" min={1} max={99} value={rsiSellAbove} onChange={(e) => setRsiSellAbove(e.target.value)} className="input tabular" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="bt-fast">Fast period</label>
                <input id="bt-fast" type="number" min={2} max={200} value={fastPeriod} onChange={(e) => setFastPeriod(e.target.value)} className="input tabular" />
              </div>
              <div>
                <label className="label" htmlFor="bt-slow">Slow period</label>
                <input id="bt-slow" type="number" min={3} max={400} value={slowPeriod} onChange={(e) => setSlowPeriod(e.target.value)} className="input tabular" />
              </div>
            </>
          )}
          <div>
            <label className="label" htmlFor="bt-fee">Fee (bps / fill)</label>
            <input id="bt-fee" type="number" min={0} max={100} value={feeBps} onChange={(e) => setFeeBps(e.target.value)} className="input tabular" />
          </div>
          <div className="flex items-end">
            <button onClick={run} disabled={pending} className="btn btn-primary w-full">
              {pending ? "Running…" : "Run backtest"}
            </button>
          </div>
        </div>
        <p className="border-t border-line px-4 py-2 text-2xs text-fg-2">
          {strategyInfo.blurb} Starting cash $10,000 · long-only · fills at next bar open.
        </p>
      </Panel>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded border border-down/40 bg-down-bg px-3 py-2 text-sm text-down">
          <IconWarning size={16} />
          {error}
        </div>
      )}

      {!result ? (
        <Panel>
          <EmptyState
            title="No backtest yet"
            body="Pick a market, strategy and parameters, then run it over real history."
            icon={<IconBacktest size={28} />}
          />
        </Panel>
      ) : (
        <>
          <Panel
            title={
              meta
                ? `Results · ${prettySymbol(meta.symbol)} · ${meta.timeframe} · ${meta.bars} bars`
                : "Results"
            }
          >
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
              <Stat
                label="Total return"
                value={formatPct(result.totalReturnPct)}
                valueClassName={signClass(result.totalReturnPct)}
              />
              <Stat label="Final equity" value={formatUsd(result.finalEquity)} />
              <Stat
                label="Win rate"
                value={`${result.winRatePct.toFixed(1)}%`}
                hint={`${result.winCount}/${result.tradeCount} trades`}
              />
              <Stat
                label="Max drawdown"
                value={`−${result.maxDrawdownPct.toFixed(2)}%`}
                valueClassName="text-down"
              />
              <Stat
                label="Profit factor"
                value={Number.isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"}
              />
              <Stat
                label="Avg trade P&L"
                value={formatSignedUsd(result.avgTradePnl)}
                valueClassName={signClass(result.avgTradePnl)}
              />
            </div>
          </Panel>

          <Panel title="Equity curve" bodyClassName="overflow-hidden p-2">
            <EquityCurve points={result.equityCurve} startingCash={result.initialCash} />
          </Panel>

          <Panel title={`Trades (${result.trades.length})`} bodyClassName="overflow-hidden">
            {result.trades.length === 0 ? (
              <p className="p-6 text-sm text-fg-1">
                The strategy never opened a position over this window.
              </p>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-bg-1">
                    <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-fg-2">
                      <th className="px-4 py-2 font-medium">Entry</th>
                      <th className="px-4 py-2 font-medium">Exit</th>
                      <th className="px-4 py-2 text-right font-medium">Entry price</th>
                      <th className="px-4 py-2 text-right font-medium">Exit price</th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">P&L</th>
                      <th className="px-4 py-2 text-right font-medium">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} className="border-b border-line/60 last:border-0">
                        <td className="tabular px-4 py-2 text-2xs text-fg-2">
                          {formatDateTime(t.entryTime)}
                        </td>
                        <td className="tabular px-4 py-2 text-2xs text-fg-2">
                          {formatDateTime(t.exitTime)}
                        </td>
                        <td className="tabular px-4 py-2 text-right text-fg-1">
                          {formatPrice(t.entryPrice)}
                        </td>
                        <td className="tabular px-4 py-2 text-right text-fg-1">
                          {formatPrice(t.exitPrice)}
                        </td>
                        <td className="tabular px-4 py-2 text-right text-fg-2">
                          {formatNumber(t.quantity, 6)}
                        </td>
                        <td className={clsx("tabular px-4 py-2 text-right", signClass(t.pnl))}>
                          {formatSignedUsd(t.pnl)}
                        </td>
                        <td className={clsx("tabular px-4 py-2 text-right", signClass(t.returnPct))}>
                          {formatPct(t.returnPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
