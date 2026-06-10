"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Candle, Timeframe } from "@obsidian/core";
import { TIMEFRAMES } from "@obsidian/core";
import { PriceChart, type DrawTool, type DrawingShape, type Overlays } from "./price-chart";
import { IndicatorPane, type PaneKind } from "./indicator-pane";
import { useTicker } from "@/lib/use-market";
import { prettySymbol, formatPrice, formatPct } from "@/lib/format";
import { signClass } from "./ui";
import { useToast } from "./toast";
import {
  createDrawingAction,
  clearDrawingsAction,
} from "@/app/(app)/chart/actions";

const TF_LABEL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};

type SubPane = PaneKind | "none";
const SUB_PANES: { value: SubPane; label: string }[] = [
  { value: "rsi", label: "RSI" },
  { value: "macd", label: "MACD" },
  { value: "stochastic", label: "STOCH" },
  { value: "atr", label: "ATR" },
  { value: "none", label: "NONE" },
];

const TOOLS: { value: DrawTool; label: string }[] = [
  { value: "none", label: "Cursor" },
  { value: "trendline", label: "Trendline" },
  { value: "horizontal", label: "H-Line" },
];

export function ChartWorkspace({
  symbol,
  timeframe,
  candles,
  watchlist,
  initialDrawings,
}: {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  watchlist: string[];
  initialDrawings: DrawingShape[];
}) {
  const router = useRouter();
  const ticker = useTicker(symbol, timeframe);
  const { push } = useToast();
  const [, startTransition] = useTransition();

  const [overlays, setOverlays] = useState<Overlays>({
    ema: true,
    bollinger: false,
    vwap: false,
  });
  const [subPane, setSubPane] = useState<SubPane>("rsi");
  const [tool, setTool] = useState<DrawTool>("none");
  const [drawings, setDrawings] = useState<DrawingShape[]>(initialDrawings);

  const lastClose = candles[candles.length - 1]?.close ?? 0;
  const price = ticker?.price ?? lastClose;
  const changePct = ticker?.changePct ?? 0;

  function navigate(next: { symbol?: string; tf?: Timeframe }) {
    const s = next.symbol ?? symbol;
    const tf = next.tf ?? timeframe;
    router.push(`/chart?symbol=${s}&tf=${tf}`);
  }

  function toggleOverlay(key: keyof Overlays) {
    setOverlays((o) => ({ ...o, [key]: !o[key] }));
  }

  function handleCreate(shape: Omit<DrawingShape, "id">) {
    // Optimistically add with a temp id; persist via server action.
    const tempId = `tmp-${Date.now()}`;
    setDrawings((d) => [...d, { ...shape, id: tempId }]);
    startTransition(async () => {
      const result = await createDrawingAction({
        symbol,
        timeframe,
        kind: shape.kind,
        x1: shape.x1,
        y1: shape.y1,
        x2: shape.x2 ?? undefined,
        y2: shape.y2 ?? undefined,
      });
      if (!result.ok) {
        setDrawings((d) => d.filter((x) => x.id !== tempId));
        push({ kind: "warning", title: "Couldn't save drawing", body: result.error });
      }
    });
  }

  function handleClear() {
    setDrawings([]);
    startTransition(() => clearDrawingsAction(symbol, timeframe));
  }

  const overlayButtons: { key: keyof Overlays; label: string }[] = [
    { key: "ema", label: "EMA" },
    { key: "bollinger", label: "BB" },
    { key: "vwap", label: "VWAP" },
  ];

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

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe switcher */}
          <div className="flex overflow-hidden rounded border border-line">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => navigate({ tf })}
                className={clsx(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  tf === timeframe ? "bg-bg-3 text-fg-0" : "bg-bg-1 text-fg-1 hover:bg-bg-2",
                )}
                aria-pressed={tf === timeframe}
              >
                {TF_LABEL[tf]}
              </button>
            ))}
          </div>

          {/* Overlay toggles */}
          <div className="flex overflow-hidden rounded border border-line">
            {overlayButtons.map((o) => (
              <button
                key={o.key}
                onClick={() => toggleOverlay(o.key)}
                className={clsx(
                  "px-2.5 py-1 text-xs font-medium uppercase",
                  overlays[o.key] ? "bg-bg-3 text-fg-0" : "bg-bg-1 text-fg-1 hover:bg-bg-2",
                )}
                aria-pressed={overlays[o.key]}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Sub-pane selector */}
          <div className="flex overflow-hidden rounded border border-line">
            {SUB_PANES.map((p) => (
              <button
                key={p.value}
                onClick={() => setSubPane(p.value)}
                className={clsx(
                  "px-2 py-1 text-xs font-medium",
                  subPane === p.value ? "bg-bg-3 text-fg-0" : "bg-bg-1 text-fg-1 hover:bg-bg-2",
                )}
                aria-pressed={subPane === p.value}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Drawing tools */}
          <div className="flex overflow-hidden rounded border border-line">
            {TOOLS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTool(t.value)}
                className={clsx(
                  "px-2 py-1 text-xs font-medium",
                  tool === t.value ? "bg-bg-3 text-fg-0" : "bg-bg-1 text-fg-1 hover:bg-bg-2",
                )}
                aria-pressed={tool === t.value}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleClear}
            disabled={drawings.length === 0}
            className="rounded border border-line px-2 py-1 text-xs font-medium text-fg-1 hover:bg-bg-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {tool !== "none" && (
        <div className="border-b border-line bg-bg-2 px-4 py-1.5 text-2xs text-fg-1">
          {tool === "horizontal"
            ? "Click on the chart to place a horizontal level."
            : "Click two points on the chart to draw a trendline."}
        </div>
      )}

      {/* Charts */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={clsx("min-h-0", subPane === "none" ? "flex-1" : "flex-[3]")}>
          <PriceChart
            key={`${symbol}-${timeframe}-price`}
            symbol={symbol}
            timeframe={timeframe}
            initial={candles}
            overlays={overlays}
            tool={tool}
            drawings={drawings}
            onCreateDrawing={handleCreate}
            onToolConsumed={() => setTool("none")}
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
