"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type AreaData,
  type Time,
} from "lightweight-charts";
import { EmptyState } from "./ui";
import { IconActivity } from "./icons";

const THEME = {
  bg: "#101216",
  grid: "#1a1d22",
  text: "#9aa0a8",
  border: "#23262d",
  line: "#e6e8eb",
  areaTop: "rgba(230,232,235,0.10)",
  areaBottom: "rgba(230,232,235,0.0)",
  guide: "#2f333b",
};

/**
 * Realized-equity curve. Plots starting cash plus cumulative realized P&L over
 * the account's trade history (computed server-side). A dashed baseline marks
 * the starting cash so draw-down / growth reads at a glance. Unrealized P&L is
 * intentionally not folded in here — this is the settled curve.
 */
export function EquityCurve({
  points,
  startingCash,
}: {
  points: { time: number; equity: number }[];
  startingCash: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container || points.length === 0) return;

    const chart: IChartApi = createChart(container, {
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
      handleScale: false,
      handleScroll: false,
    });

    const series = chart.addAreaSeries({
      lineColor: THEME.line,
      lineWidth: 2,
      topColor: THEME.areaTop,
      bottomColor: THEME.areaBottom,
      priceLineVisible: false,
    });

    series.createPriceLine({
      price: startingCash,
      color: THEME.guide,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "start",
    });

    // De-duplicate identical timestamps (multiple fills in the same second);
    // lightweight-charts requires strictly increasing time.
    const seen = new Map<number, number>();
    for (const p of points) seen.set(Math.floor(p.time / 1000), p.equity);
    const data: AreaData[] = [...seen.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, equity]) => ({ time: t as Time, value: equity }));

    series.setData(data);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [points, startingCash]);

  if (points.length === 0) {
    return (
      <EmptyState
        title="No realized P&L yet"
        body="Your equity curve appears once you close a position and realize a gain or loss."
        icon={<IconActivity size={28} />}
      />
    );
  }

  return <div ref={ref} className="h-56 w-full" />;
}
