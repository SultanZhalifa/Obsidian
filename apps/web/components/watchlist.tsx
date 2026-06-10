"use client";

import Link from "next/link";
import { useEffect, useReducer, useState, useTransition } from "react";
import type { ServerMessage } from "@obsidian/core";
import { getGatewayClient } from "@/lib/ws-client";
import type { Ticker24h } from "@/lib/market";
import {
  baseAsset,
  formatPrice,
  formatPct,
  formatCompact,
  prettySymbol,
} from "@/lib/format";
import { signClass, EmptyState } from "./ui";
import { IconArrowUp, IconArrowDown, IconX, IconSearch, IconChart } from "./icons";
import { SymbolSearch } from "./symbol-search";
import { removeSymbolAction } from "@/app/(app)/dashboard/actions";

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

export function Watchlist({
  symbols,
  initial,
}: {
  symbols: string[];
  initial: Ticker24h[];
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [rows, dispatch] = useReducer(
    reducer,
    new Map(initial.map((t) => [t.symbol, { ...t, dir: 0 }])),
  );

  useEffect(() => {
    const client = getGatewayClient();
    const unsubs = symbols.map((s) => client.subscribe(s, "1m"));
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
  }, [symbols]);

  // Render in the watchlist's own order; a row may lack ticker data briefly for
  // a just-added symbol, so fall back to a placeholder zero row.
  const list = symbols.map(
    (sym) =>
      rows.get(sym) ?? {
        symbol: sym,
        lastPrice: 0,
        priceChangePercent: 0,
        highPrice: 0,
        lowPrice: 0,
        quoteVolume: 0,
        dir: 0,
      },
  );

  return (
    <>
      <div className="flex items-center justify-end border-b border-line px-3 py-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="btn px-2.5 py-1 text-xs"
        >
          <IconSearch size={14} />
          Add market
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Your watchlist is empty"
          body="Add a market to start tracking live prices."
          icon={<IconChart size={28} />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
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
                <th className="px-4 py-2 text-right font-medium" aria-label="Actions"></th>
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
                    className={`tabular px-4 py-2.5 text-right text-fg-0 ${
                      row.dir > 0
                        ? "animate-flash-up"
                        : row.dir < 0
                          ? "animate-flash-down"
                          : ""
                    }`}
                  >
                    {row.lastPrice ? formatPrice(row.lastPrice) : "—"}
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
                    {row.highPrice ? formatPrice(row.highPrice) : "—"}
                  </td>
                  <td className="tabular hidden px-4 py-2.5 text-right text-fg-1 sm:table-cell">
                    {row.lowPrice ? formatPrice(row.lowPrice) : "—"}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-fg-1">
                    {formatCompact(row.quoteVolume)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <RemoveButton symbol={row.symbol} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {searchOpen && (
        <SymbolSearch existing={symbols} onClose={() => setSearchOpen(false)} />
      )}
    </>
  );
}

function RemoveButton({ symbol }: { symbol: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("symbol", symbol);
        startTransition(() => removeSymbolAction(fd));
      }}
      className="rounded p-1 text-fg-2 opacity-0 transition-opacity hover:bg-bg-3 hover:text-down focus:opacity-100 group-hover:opacity-100"
      aria-label={`Remove ${prettySymbol(symbol)} from watchlist`}
    >
      <IconX size={15} />
    </button>
  );
}
