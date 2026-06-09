"use client";

import Link from "next/link";
import { useEffect, useReducer } from "react";
import type { ServerMessage } from "@obsidian/core";
import { getGatewayClient } from "@/lib/ws-client";
import type { Ticker24h } from "@/lib/market";
import {
  baseAsset,
  formatPrice,
  formatPct,
  formatCompact,
} from "@/lib/format";
import { signClass } from "./ui";
import { IconArrowUp, IconArrowDown } from "./icons";

interface Row extends Ticker24h {
  dir: number;
}

type Action = { symbol: string; price: number; changePct?: number; volume?: number };

function reducer(state: Map<string, Row>, action: Action): Map<string, Row> {
  const existing = state.get(action.symbol);
  if (!existing) return state;
  const dir = Math.sign(action.price - existing.lastPrice) || existing.dir;
  const next = new Map(state);
  next.set(action.symbol, {
    ...existing,
    lastPrice: action.price,
    priceChangePercent: action.changePct ?? existing.priceChangePercent,
    quoteVolume: action.volume ?? existing.quoteVolume,
    dir,
  });
  return next;
}

export function Watchlist({ initial }: { initial: Ticker24h[] }) {
  const [rows, dispatch] = useReducer(
    reducer,
    new Map(initial.map((t) => [t.symbol, { ...t, dir: 0 }])),
  );

  useEffect(() => {
    const client = getGatewayClient();
    const unsubs = initial.map((t) => client.subscribe(t.symbol, "1m"));
    const unListen = client.addListener((msg: ServerMessage) => {
      if (msg.type === "ticker") {
        dispatch({
          symbol: msg.symbol,
          price: msg.price,
          changePct: msg.changePct,
          volume: msg.volume,
        });
      } else if (msg.type === "trade") {
        dispatch({ symbol: msg.symbol, price: msg.price });
      }
    });
    return () => {
      unListen();
      unsubs.forEach((u) => u());
    };
  }, [initial]);

  const list = initial.map((t) => rows.get(t.symbol)!).filter(Boolean);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-fg-2">
            <th className="px-4 py-2 font-medium">Market</th>
            <th className="px-4 py-2 text-right font-medium">Last price</th>
            <th className="px-4 py-2 text-right font-medium">24h change</th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
              24h high
            </th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
              24h low
            </th>
            <th className="px-4 py-2 text-right font-medium">24h volume</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr
              key={row.symbol}
              className="group border-b border-line/60 last:border-0 hover:bg-bg-2"
            >
              <td className="px-4 py-2.5">
                <Link
                  href={`/chart?symbol=${row.symbol}`}
                  className="flex items-center gap-2.5"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-bg-2 text-2xs font-semibold text-fg-0">
                    {baseAsset(row.symbol).slice(0, 3)}
                  </span>
                  <span className="font-medium text-fg-0">
                    {baseAsset(row.symbol)}
                    <span className="text-fg-2">
                      /{row.symbol.replace(baseAsset(row.symbol), "")}
                    </span>
                  </span>
                </Link>
              </td>
              <td
                key={`${row.symbol}-${row.lastPrice}`}
                className={`tabular px-4 py-2.5 text-right text-fg-0 ${
                  row.dir > 0
                    ? "animate-flash-up"
                    : row.dir < 0
                      ? "animate-flash-down"
                      : ""
                }`}
              >
                {formatPrice(row.lastPrice)}
              </td>
              <td className={`tabular px-4 py-2.5 text-right ${signClass(row.priceChangePercent)}`}>
                <span className="inline-flex items-center justify-end gap-1">
                  {row.priceChangePercent > 0 ? (
                    <IconArrowUp size={13} />
                  ) : row.priceChangePercent < 0 ? (
                    <IconArrowDown size={13} />
                  ) : null}
                  {formatPct(row.priceChangePercent)}
                </span>
              </td>
              <td className="tabular hidden px-4 py-2.5 text-right text-fg-1 sm:table-cell">
                {formatPrice(row.highPrice)}
              </td>
              <td className="tabular hidden px-4 py-2.5 text-right text-fg-1 sm:table-cell">
                {formatPrice(row.lowPrice)}
              </td>
              <td className="tabular px-4 py-2.5 text-right text-fg-1">
                {formatCompact(row.quoteVolume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
