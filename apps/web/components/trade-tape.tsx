"use client";

import { useEffect, useRef, useState } from "react";
import type { ServerMessage, Timeframe } from "@obsidian/core";
import { getGatewayClient } from "@/lib/ws-client";
import { formatPrice, formatNumber, formatTime } from "@/lib/format";
import { EmptyState } from "./ui";
import { IconActivity } from "./icons";

interface Trade {
  id: number;
  price: number;
  qty: number;
  side: "buy" | "sell";
  at: number;
}

const MAX_TRADES = 40;

export function TradeTape({
  symbol,
  timeframe = "1m",
}: {
  symbol: string;
  timeframe?: Timeframe;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    setTrades([]);
    const client = getGatewayClient();
    const unSub = client.subscribe(symbol, timeframe);
    const unListen = client.addListener((msg: ServerMessage) => {
      if (msg.type !== "trade" || msg.symbol !== symbol.toUpperCase()) return;
      setTrades((prev) => {
        const next = [
          { id: seq.current++, price: msg.price, qty: msg.quantity, side: msg.side, at: msg.at },
          ...prev,
        ];
        return next.slice(0, MAX_TRADES);
      });
    });
    return () => {
      unListen();
      unSub();
    };
  }, [symbol, timeframe]);

  if (trades.length === 0) {
    return (
      <EmptyState
        title="Waiting for trades"
        body="Live market trades will stream here in real time."
        icon={<IconActivity size={28} />}
      />
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="grid grid-cols-3 border-b border-line px-3 py-1.5 text-2xs uppercase tracking-wide text-fg-2">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trades.map((t) => (
          <div key={t.id} className="grid animate-fade-in grid-cols-3 px-3 py-[3px]">
            <span className={`tabular ${t.side === "buy" ? "text-up" : "text-down"}`}>
              {formatPrice(t.price)}
            </span>
            <span className="tabular text-right text-fg-1">{formatNumber(t.qty, 4)}</span>
            <span className="tabular text-right text-fg-2">{formatTime(t.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
