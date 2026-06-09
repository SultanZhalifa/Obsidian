"use client";

import { useEffect, useState, useTransition } from "react";
import type { PositionRow } from "@obsidian/db/schema";
import type { ServerMessage } from "@obsidian/core";
import { getGatewayClient } from "@/lib/ws-client";
import {
  formatPrice,
  formatNumber,
  formatSignedUsd,
  formatUsd,
  baseAsset,
} from "@/lib/format";
import { signClass, EmptyState } from "./ui";
import { IconWallet } from "./icons";
import { closePositionAction } from "@/app/(app)/trade/actions";

interface LivePos {
  row: PositionRow;
  mark: number;
}

/** Unrealized P&L for a signed position at the current mark. */
function unrealized(row: PositionRow, mark: number): number {
  if (row.quantity === 0 || mark === 0) return 0;
  return (mark - row.avgPrice) * row.quantity;
}

export function PositionsTable({
  positions,
  onEquityChange,
}: {
  positions: PositionRow[];
  onEquityChange?: (unrealizedTotal: number) => void;
}) {
  const open = positions.filter((p) => Math.abs(p.quantity) > 1e-9);
  const [marks, setMarks] = useState<Record<string, number>>(() =>
    Object.fromEntries(open.map((p) => [p.symbol, p.avgPrice])),
  );

  useEffect(() => {
    if (open.length === 0) return;
    const client = getGatewayClient();
    const unsubs = open.map((p) => client.subscribe(p.symbol, "1m"));
    const unListen = client.addListener((msg: ServerMessage) => {
      if ((msg.type === "trade" || msg.type === "ticker")) {
        setMarks((prev) =>
          prev[msg.symbol] === msg.price ? prev : { ...prev, [msg.symbol]: msg.price },
        );
      }
    });
    return () => {
      unListen();
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  useEffect(() => {
    if (!onEquityChange) return;
    const total = open.reduce(
      (sum, p) => sum + unrealized(p, marks[p.symbol] ?? p.avgPrice),
      0,
    );
    onEquityChange(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, positions]);

  if (open.length === 0) {
    return (
      <EmptyState
        title="No open positions"
        body="Place an order from the ticket to open a position. P&L updates live."
        icon={<IconWallet size={28} />}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-fg-2">
            <th className="px-4 py-2 font-medium">Market</th>
            <th className="px-4 py-2 text-right font-medium">Side</th>
            <th className="px-4 py-2 text-right font-medium">Qty</th>
            <th className="px-4 py-2 text-right font-medium">Avg price</th>
            <th className="px-4 py-2 text-right font-medium">Mark</th>
            <th className="px-4 py-2 text-right font-medium">Unrealized</th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Realized</th>
            <th className="px-4 py-2 text-right font-medium" aria-label="Actions"></th>
          </tr>
        </thead>
        <tbody>
          {open.map((p) => {
            const mark = marks[p.symbol] ?? p.avgPrice;
            const u = unrealized(p, mark);
            const long = p.quantity > 0;
            return (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2.5 font-medium text-fg-0">
                  {baseAsset(p.symbol)}
                  <span className="text-fg-2">/{p.symbol.replace(baseAsset(p.symbol), "")}</span>
                </td>
                <td className={`px-4 py-2.5 text-right ${long ? "text-up" : "text-down"}`}>
                  {long ? "Long" : "Short"}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-fg-1">
                  {formatNumber(Math.abs(p.quantity), 6)}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-fg-1">
                  {formatPrice(p.avgPrice)}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-fg-0">
                  {formatPrice(mark)}
                </td>
                <td className={`tabular px-4 py-2.5 text-right ${signClass(u)}`}>
                  {formatSignedUsd(u)}
                </td>
                <td className={`tabular hidden px-4 py-2.5 text-right sm:table-cell ${signClass(p.realizedPnl)}`}>
                  {formatUsd(p.realizedPnl)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ClosePositionButton symbol={p.symbol} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One-click flatten of a single position via the server action. */
function ClosePositionButton({ symbol }: { symbol: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("symbol", symbol);
        startTransition(() => closePositionAction(fd));
      }}
      className="btn px-2.5 py-1 text-2xs"
      aria-label={`Close ${symbol} position`}
    >
      {pending ? "Closing…" : "Close"}
    </button>
  );
}
