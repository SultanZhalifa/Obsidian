"use client";

import { useEffect, useState } from "react";
import type { ServerMessage, Timeframe } from "@obsidian/core";
import { getGatewayClient } from "@/lib/ws-client";
import { formatPrice, formatNumber } from "@/lib/format";
import { EmptyState } from "./ui";
import { IconBook } from "./icons";

interface Level {
  price: number;
  qty: number;
}

const ROWS = 12;

/** Build cumulative-depth rows and the max cumulative for bar scaling. */
function prepare(levels: Level[]): { rows: (Level & { cum: number })[]; max: number } {
  let cum = 0;
  const rows = levels.slice(0, ROWS).map((l) => {
    cum += l.qty;
    return { ...l, cum };
  });
  return { rows, max: cum || 1 };
}

export function OrderBook({
  symbol,
  timeframe = "1m",
}: {
  symbol: string;
  timeframe?: Timeframe;
}) {
  const [bids, setBids] = useState<Level[]>([]);
  const [asks, setAsks] = useState<Level[]>([]);
  const [spread, setSpread] = useState<{ abs: number; pct: number } | null>(null);

  useEffect(() => {
    const client = getGatewayClient();
    const unSub = client.subscribe(symbol, timeframe);
    const unListen = client.addListener((msg: ServerMessage) => {
      if (msg.type !== "depth" || msg.symbol !== symbol.toUpperCase()) return;
      const b = msg.bids.map(([price, qty]) => ({ price, qty })).filter((l) => l.qty > 0);
      const a = msg.asks.map(([price, qty]) => ({ price, qty })).filter((l) => l.qty > 0);
      setBids(b);
      setAsks(a);
      const bestBid = b[0]?.price;
      const bestAsk = a[0]?.price;
      if (bestBid && bestAsk) {
        const abs = bestAsk - bestBid;
        setSpread({ abs, pct: (abs / bestAsk) * 100 });
      }
    });
    return () => {
      unListen();
      unSub();
    };
  }, [symbol, timeframe]);

  if (bids.length === 0 && asks.length === 0) {
    return (
      <EmptyState
        title="Waiting for order book"
        body="Live bid/ask depth will appear as soon as the feed connects."
        icon={<IconBook size={28} />}
      />
    );
  }

  const askView = prepare(asks);
  const bidView = prepare(bids);
  const max = Math.max(askView.max, bidView.max);

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="grid grid-cols-3 border-b border-line px-3 py-1.5 text-2xs uppercase tracking-wide text-fg-2">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (reversed so best ask sits next to the spread) */}
      <div className="flex flex-1 flex-col-reverse justify-end overflow-hidden">
        {askView.rows.map((l) => (
          <Row key={`a-${l.price}`} level={l} max={max} side="ask" />
        ))}
      </div>

      {spread && (
        <div className="flex items-center justify-between border-y border-line bg-bg-2 px-3 py-1.5">
          <span className="text-2xs uppercase tracking-wide text-fg-2">Spread</span>
          <span className="tabular text-fg-1">
            {formatPrice(spread.abs)} ({spread.pct.toFixed(3)}%)
          </span>
        </div>
      )}

      {/* Bids */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {bidView.rows.map((l) => (
          <Row key={`b-${l.price}`} level={l} max={max} side="bid" />
        ))}
      </div>
    </div>
  );
}

function Row({
  level,
  max,
  side,
}: {
  level: Level & { cum: number };
  max: number;
  side: "bid" | "ask";
}) {
  const pct = Math.min(100, (level.cum / max) * 100);
  const barColor = side === "bid" ? "var(--up-bg)" : "var(--down-bg)";
  const priceColor = side === "bid" ? "text-up" : "text-down";
  return (
    <div className="relative grid grid-cols-3 px-3 py-[3px]">
      <div
        className="absolute inset-y-0 right-0"
        style={{ width: `${pct}%`, backgroundColor: barColor }}
        aria-hidden="true"
      />
      <span className={`tabular relative ${priceColor}`}>{formatPrice(level.price)}</span>
      <span className="tabular relative text-right text-fg-1">
        {formatNumber(level.qty, 4)}
      </span>
      <span className="tabular relative text-right text-fg-2">
        {formatNumber(level.cum, 3)}
      </span>
    </div>
  );
}
