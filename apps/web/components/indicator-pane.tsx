"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type LineData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import type { Candle, ServerMessage, Timeframe } from "@obsidian/core";
import { rsi, macd, stochastic, atr } from "@obsidian/core";
import { getGatewayClient } from "@/lib/ws-client";

const THEME = {
  bg: "#101216",
  grid: "#1a1d22",
  text: "#9aa0a8",
  border: "#23262d",
  line: "#e6e8eb",
  signal: "#6b7178",
  k: "#e6e8eb",
  d: "#cbb079",
  up: "rgba(111,191,134,0.5)",
  down: "rgba(208,138,138,0.5)",
  guide: "#2f333b",
};

export type PaneKind = "rsi" | "macd" | "stochastic" | "atr";

function baseChart(container: HTMLDivElement): IChartApi {
  return createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: THEME.bg },
      textColor: THEME.text,
      fontFamily: "var(--font-mono)",
      fontSize: 10,
    },
    grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
    rightPriceScale: { borderColor: THEME.border },
    timeScale: { borderColor: THEME.border, timeVisible: true, secondsVisible: false },
    autoSize: true,
  });
}

const sec = (c: Candle) => (c.time / 1000) as Time;

export function IndicatorPane({
  kind,
  symbol,
  timeframe,
  initial,
}: {
  kind: PaneKind;
  symbol: string;
  timeframe: Timeframe;
  initial: Candle[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const candlesRef = useRef<Candle[]>(initial);

  useEffect(() => {
    candlesRef.current = initial.slice();
  }, [initial]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = baseChart(container);

    // Build the kind-specific series and a draw() that fills them.
    let draw: () => void;

    if (kind === "rsi") {
      const series = chart.addLineSeries({ color: THEME.line, lineWidth: 1 });
      series.createPriceLine({ price: 70, color: THEME.guide, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
      series.createPriceLine({ price: 30, color: THEME.guide, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });
      series.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
      draw = () => {
        const candles = candlesRef.current;
        const vals = rsi(candles.map((c) => c.close), 14);
        const data: LineData[] = [];
        for (let i = 0; i < candles.length; i++) {
          const v = vals[i];
          if (v != null) data.push({ time: sec(candles[i]!), value: v });
        }
        series.setData(data);
      };
    } else if (kind === "stochastic") {
      const kLine = chart.addLineSeries({ color: THEME.k, lineWidth: 1 });
      const dLine = chart.addLineSeries({ color: THEME.d, lineWidth: 1 });
      kLine.createPriceLine({ price: 80, color: THEME.guide, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "80" });
      kLine.createPriceLine({ price: 20, color: THEME.guide, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "20" });
      kLine.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
      draw = () => {
        const candles = candlesRef.current;
        const vals = stochastic(candles, 14, 3, 3);
        const kd: LineData[] = [];
        const dd: LineData[] = [];
        for (let i = 0; i < candles.length; i++) {
          const p = vals[i];
          if (!p) continue;
          const t = sec(candles[i]!);
          kd.push({ time: t, value: p.k });
          dd.push({ time: t, value: p.d });
        }
        kLine.setData(kd);
        dLine.setData(dd);
      };
    } else if (kind === "atr") {
      const series = chart.addLineSeries({ color: THEME.line, lineWidth: 1 });
      draw = () => {
        const candles = candlesRef.current;
        const vals = atr(candles, 14);
        const data: LineData[] = [];
        for (let i = 0; i < candles.length; i++) {
          const v = vals[i];
          if (v != null) data.push({ time: sec(candles[i]!), value: v });
        }
        series.setData(data);
      };
    } else {
      // MACD: histogram + macd line + signal line.
      const hist = chart.addHistogramSeries({ priceLineVisible: false });
      const macdLine = chart.addLineSeries({ color: THEME.line, lineWidth: 1, priceLineVisible: false });
      const signalLine = chart.addLineSeries({ color: THEME.signal, lineWidth: 1, priceLineVisible: false });
      draw = () => {
        const candles = candlesRef.current;
        const m = macd(candles.map((c) => c.close), 12, 26, 9);
        const h: HistogramData[] = [];
        const ml: LineData[] = [];
        const sl: LineData[] = [];
        for (let i = 0; i < candles.length; i++) {
          const p = m[i];
          if (!p) continue;
          const t = sec(candles[i]!);
          h.push({ time: t, value: p.histogram, color: p.histogram >= 0 ? THEME.up : THEME.down });
          ml.push({ time: t, value: p.macd });
          sl.push({ time: t, value: p.signal });
        }
        hist.setData(h);
        macdLine.setData(ml);
        signalLine.setData(sl);
      };
    }

    draw();
    chart.timeScale().fitContent();

    const client = getGatewayClient();
    const unSub = client.subscribe(symbol, timeframe);
    const unListen = client.addListener((msg: ServerMessage) => {
      if (msg.type !== "kline" || msg.symbol !== symbol.toUpperCase() || msg.timeframe !== timeframe) return;
      const c = msg.candle;
      const s = candlesRef.current;
      const last = s[s.length - 1];
      if (last && last.time === c.time) s[s.length - 1] = c;
      else s.push(c);
      if (msg.closed) draw();
    });

    return () => {
      unListen();
      unSub();
      chart.remove();
    };
  }, [kind, symbol, timeframe]);

  return <div ref={containerRef} className="h-full w-full" />;
}
