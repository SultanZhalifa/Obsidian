"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from "lightweight-charts";
import type { Candle, ServerMessage, Timeframe } from "@obsidian/core";
import { ema } from "@obsidian/core";
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
};

function toLineData(
  candles: Candle[],
  values: (number | null)[],
): LineData[] {
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
  showEma,
}: {
  symbol: string;
  timeframe: Timeframe;
  initial: Candle[];
  showEma: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const candlesRef = useRef<Candle[]>(initial);

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
      grid: {
        vertLines: { color: THEME.grid },
        horzLines: { color: THEME.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: THEME.border },
      timeScale: { borderColor: THEME.border, timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addCandlestickSeries({
      upColor: THEME.up,
      downColor: THEME.down,
      borderUpColor: THEME.up,
      borderDownColor: THEME.down,
      wickUpColor: THEME.up,
      wickDownColor: THEME.down,
    });

    const volumeSeries: ISeriesApi<"Histogram"> = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: THEME.volume,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const ema12Series = showEma
      ? chart.addLineSeries({ color: THEME.ema12, lineWidth: 1, priceLineVisible: false })
      : null;
    const ema26Series = showEma
      ? chart.addLineSeries({ color: THEME.ema26, lineWidth: 1, priceLineVisible: false })
      : null;

    function render(candles: Candle[]) {
      const cData: CandlestickData[] = candles.map((c) => ({
        time: (c.time / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      const vData: HistogramData[] = candles.map((c) => ({
        time: (c.time / 1000) as Time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(111,191,134,0.35)" : "rgba(208,138,138,0.35)",
      }));
      candleSeries.setData(cData);
      volumeSeries.setData(vData);
      if (ema12Series && ema26Series) {
        const closes = candles.map((c) => c.close);
        ema12Series.setData(toLineData(candles, ema(closes, 12)));
        ema26Series.setData(toLineData(candles, ema(closes, 26)));
      }
    }

    render(candlesRef.current);
    chart.timeScale().fitContent();

    // Live updates from the gateway.
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

      // Maintain the local series for EMA recompute on closed bars.
      const series = candlesRef.current;
      const last = series[series.length - 1];
      if (last && last.time === c.time) series[series.length - 1] = c;
      else series.push(c);

      if (msg.closed && ema12Series && ema26Series) {
        const closes = series.map((x) => x.close);
        ema12Series.setData(toLineData(series, ema(closes, 12)));
        ema26Series.setData(toLineData(series, ema(closes, 26)));
      }
    });

    return () => {
      unListen();
      unSub();
      chart.remove();
    };
  }, [symbol, timeframe, showEma]);

  // Reset local candle buffer whenever the backfill changes (symbol/timeframe).
  useEffect(() => {
    candlesRef.current = initial.slice();
  }, [initial]);

  return <div ref={containerRef} className="h-full w-full" />;
}
