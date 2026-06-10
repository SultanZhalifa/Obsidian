"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import type { Candle, ServerMessage, Timeframe } from "@obsidian/core";
import { ema, bollinger, vwap } from "@obsidian/core";
import { getGatewayClient } from "@/lib/ws-client";

/** Monochrome chart theme derived from the design tokens. */
const THEME = {
  bg: "#101216",
  grid: "#1a1d22",
  text: "#9aa0a8",
  border: "#23262d",
  up: "#6fbf86",
  down: "#d08a8a",
  ema12: "#e6e8eb",
  ema26: "#6b7178",
  volume: "#2f333b",
  band: "#8fa3bf",
  vwap: "#cbb079",
  drawing: "#e6e8eb",
};

export type DrawTool = "none" | "trendline" | "horizontal";

export interface DrawingShape {
  id: string;
  kind: "trendline" | "horizontal";
  x1: number; // chart time (epoch seconds)
  y1: number; // price
  x2?: number | null;
  y2?: number | null;
}

export interface Overlays {
  ema: boolean;
  bollinger: boolean;
  vwap: boolean;
}

function toLineData(candles: Candle[], values: (number | null)[]): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = values[i];
    if (v != null) out.push({ time: (candles[i]!.time / 1000) as Time, value: v });
  }
  return out;
}

export function PriceChart({
  symbol,
  timeframe,
  initial,
  overlays,
  tool,
  drawings,
  onCreateDrawing,
  onToolConsumed,
}: {
  symbol: string;
  timeframe: Timeframe;
  initial: Candle[];
  overlays: Overlays;
  tool: DrawTool;
  drawings: DrawingShape[];
  onCreateDrawing: (d: Omit<DrawingShape, "id">) => void;
  onToolConsumed: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const candlesRef = useRef<Candle[]>(initial);

  // Refs let click handlers see the current tool/callbacks without re-mounting.
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const onCreateRef = useRef(onCreateDrawing);
  onCreateRef.current = onCreateDrawing;
  const onConsumedRef = useRef(onToolConsumed);
  onConsumedRef.current = onToolConsumed;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart: IChartApi = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: THEME.bg },
        textColor: THEME.text,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: THEME.border },
      timeScale: { borderColor: THEME.border, timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: THEME.up,
      downColor: THEME.down,
      borderUpColor: THEME.up,
      borderDownColor: THEME.down,
      wickUpColor: THEME.up,
      wickDownColor: THEME.down,
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: THEME.volume,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const ema12Series = overlays.ema
      ? chart.addLineSeries({ color: THEME.ema12, lineWidth: 1, priceLineVisible: false })
      : null;
    const ema26Series = overlays.ema
      ? chart.addLineSeries({ color: THEME.ema26, lineWidth: 1, priceLineVisible: false })
      : null;

    const bbUpper = overlays.bollinger
      ? chart.addLineSeries({ color: THEME.band, lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false })
      : null;
    const bbMiddle = overlays.bollinger
      ? chart.addLineSeries({ color: THEME.band, lineWidth: 1, priceLineVisible: false })
      : null;
    const bbLower = overlays.bollinger
      ? chart.addLineSeries({ color: THEME.band, lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false })
      : null;

    const vwapSeries = overlays.vwap
      ? chart.addLineSeries({ color: THEME.vwap, lineWidth: 1, priceLineVisible: false })
      : null;

    // Drawing series: one line series per trendline, price lines for horizontals.
    const trendlineSeries: ISeriesApi<"Line">[] = [];
    const priceLines: IPriceLine[] = [];

    function renderOverlays(candles: Candle[]) {
      if (ema12Series && ema26Series) {
        const closes = candles.map((c) => c.close);
        ema12Series.setData(toLineData(candles, ema(closes, 12)));
        ema26Series.setData(toLineData(candles, ema(closes, 26)));
      }
      if (bbUpper && bbMiddle && bbLower) {
        const closes = candles.map((c) => c.close);
        const bands = bollinger(closes, 20, 2);
        bbUpper.setData(toLineData(candles, bands.map((b) => (b ? b.upper : null))));
        bbMiddle.setData(toLineData(candles, bands.map((b) => (b ? b.middle : null))));
        bbLower.setData(toLineData(candles, bands.map((b) => (b ? b.lower : null))));
      }
      if (vwapSeries) {
        vwapSeries.setData(toLineData(candles, vwap(candles, true)));
      }
    }

    function renderDrawings() {
      // Clear existing.
      for (const s of trendlineSeries) chart.removeSeries(s);
      trendlineSeries.length = 0;
      for (const pl of priceLines) candleSeries.removePriceLine(pl);
      priceLines.length = 0;

      for (const d of drawings) {
        if (d.kind === "horizontal") {
          priceLines.push(
            candleSeries.createPriceLine({
              price: d.y1,
              color: THEME.drawing,
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: "",
            }),
          );
        } else if (d.x2 != null && d.y2 != null) {
          const s = chart.addLineSeries({
            color: THEME.drawing,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          const a = { time: Math.min(d.x1, d.x2) as Time, value: d.x1 <= d.x2 ? d.y1 : d.y2 };
          const b = { time: Math.max(d.x1, d.x2) as Time, value: d.x1 <= d.x2 ? d.y2 : d.y1 };
          s.setData([a, b]);
          trendlineSeries.push(s);
        }
      }
    }

    function renderPrice(candles: Candle[]) {
      candleSeries.setData(
        candles.map((c) => ({
          time: (c.time / 1000) as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
      volumeSeries.setData(
        candles.map((c) => ({
          time: (c.time / 1000) as Time,
          value: c.volume,
          color: c.close >= c.open ? "rgba(111,191,134,0.35)" : "rgba(208,138,138,0.35)",
        })),
      );
      renderOverlays(candles);
    }

    renderPrice(candlesRef.current);
    renderDrawings();
    chart.timeScale().fitContent();

    // --- Drawing interaction -------------------------------------------------
    let pendingPoint: { time: number; price: number } | null = null;

    const onClick = (param: MouseEventParams) => {
      const activeTool = toolRef.current;
      if (activeTool === "none" || !param.point || param.time == null) return;
      const price = candleSeries.coordinateToPrice(param.point.y);
      if (price == null) return;
      const time = param.time as number;

      if (activeTool === "horizontal") {
        onCreateRef.current({ kind: "horizontal", x1: time, y1: price });
        onConsumedRef.current();
        return;
      }
      // Trendline: collect two clicks.
      if (!pendingPoint) {
        pendingPoint = { time, price };
      } else {
        onCreateRef.current({
          kind: "trendline",
          x1: pendingPoint.time,
          y1: pendingPoint.price,
          x2: time,
          y2: price,
        });
        pendingPoint = null;
        onConsumedRef.current();
      }
    };
    chart.subscribeClick(onClick);

    // --- Live updates --------------------------------------------------------
    const client = getGatewayClient();
    const unSub = client.subscribe(symbol, timeframe);
    const unListen = client.addListener((msg: ServerMessage) => {
      if (msg.type !== "kline") return;
      if (msg.symbol !== symbol.toUpperCase() || msg.timeframe !== timeframe) return;

      const c = msg.candle;
      candleSeries.update({
        time: (c.time / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      });
      volumeSeries.update({
        time: (c.time / 1000) as Time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(111,191,134,0.35)" : "rgba(208,138,138,0.35)",
      });

      const series = candlesRef.current;
      const last = series[series.length - 1];
      if (last && last.time === c.time) series[series.length - 1] = c;
      else series.push(c);

      if (msg.closed) renderOverlays(series);
    });

    return () => {
      chart.unsubscribeClick(onClick);
      unListen();
      unSub();
      chart.remove();
    };
    // Re-mount when symbol/timeframe/overlays/drawings change so series match.
  }, [symbol, timeframe, overlays, drawings]);

  useEffect(() => {
    candlesRef.current = initial.slice();
  }, [initial]);

  return <div ref={containerRef} className="h-full w-full" />;
}
