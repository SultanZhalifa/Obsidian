"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Candle, Timeframe } from "@obsidian/core";
import { TIMEFRAMES } from "@obsidian/core";
import { PriceChart } from "./price-chart";
import { IndicatorPane } from "./indicator-pane";
import { useTicker } from "@/lib/use-market";
import { prettySymbol, formatPrice, formatPct } from "@/lib/format";
import { signClass } from "./ui";

const TF_LABEL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};

export function ChartWorkspace({
  symbol,
  timeframe,
  candles,
  watchlist,
}: {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  watchlist: string[];
}) {
  const router = useRouter();
  const ticker = useTicker(symbol, timeframe);
  const [showEma, setShowEma] = useState(true);
  const [subPane, setSubPane] = useState<"rsi" | "macd" | "none">("rsi");

  // Seed the displayed price from the last backfilled candle until live ticks arrive.
  const lastClose = candles[candles.length - 1]?.close ?? 0;
  const price = ticker?.price ?? lastClose;
  const changePct = ticker?.changePct ?? 0;

  function navigate(next: { symbol?: string; tf?: Timeframe }) {
    const s = next.symbol ?? symbol;
    const tf = next.tf ?? timeframe;
    router.push(`/chart?symbol=${s}&tf=${tf}`);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg-1 px-4 py-3">
        <div className="flex items-center gap-4">
          <select
            value={symbol}
            onChange={(e) => navigate({ symbol: e.target.value })}
            className="input w-auto bg-bg-2 py-1.5 text-sm font-semibold"
            aria-label="Select market"
          >
            {watchlist.map((s) => (
              <option key={s} value={s}>
                {prettySymbol(s)}
              </option>
            ))}
          </select>
          <div className="flex items-baseline gap-2">
            <span
              className={clsx(
                "tabular text-xl font-semibold text-fg-0",
                ticker?.dir === 1 && "animate-flash-up",
                ticker?.dir === -1 && "animate-flash-down",
              )}
            >
              {formatPrice(price)}
            </span>
            <span className={clsx("tabular text-sm", signClass(changePct))}>
              {formatPct(changePct)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe switcher */}
          <div className="flex overflow-hidden rounded border border-line">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => navigate({ tf })}
                className={clsx(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  tf === timeframe
                    ? "bg-bg-3 text-fg-0"
                    : "bg-bg-1 text-fg-1 hover:bg-bg-2",
                )}
                aria-pressed={tf === timeframe}
              >
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>

          {/* Indicator toggles */}
          <button
            onClick={() => setShowEma((v) => !v)}
            className={clsx(
              "rounded border px-2.5 py-1 text-xs font-medium",
              showEma ? "border-line-strong bg-bg-3 text-fg-0" : "border-line text-fg-1",
            )}
            aria-pressed={showEma}
          >
            EMA 12/26
          </button>
          <div className="flex overflow-hidden rounded border border-line">
            {(["rsi", "macd", "none"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSubPane(p)}
                className={clsx(
                  "px-2.5 py-1 text-xs font-medium uppercase",
                  subPane === p ? "bg-bg-3 text-fg-0" : "bg-bg-1 text-fg-1 hover:bg-bg-2",
                )}
                aria-pressed={subPane === p}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={clsx("min-h-0", subPane === "none" ? "flex-1" : "flex-[3]")}>
          <PriceChart
            key={`${symbol}-${timeframe}-price`}
            symbol={symbol}
            timeframe={timeframe}
            initial={candles}
            showEma={showEma}
          />
        </div>
        {subPane !== "none" && (
          <div className="min-h-0 flex-1 border-t border-line">
            <IndicatorPane
              key={`${symbol}-${timeframe}-${subPane}`}
              kind={subPane}
              symbol={symbol}
              timeframe={timeframe}
              initial={candles}
            />
          </div>
        )}
      </div>
    </div>
  );
}
