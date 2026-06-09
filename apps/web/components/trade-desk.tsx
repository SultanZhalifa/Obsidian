"use client";

import { useState } from "react";
import type { Account, PositionRow, Trade } from "@obsidian/db/schema";
import { Panel, Stat, signClass } from "./ui";
import { PositionsTable } from "./positions-table";
import { OrderTicket } from "./order-ticket";
import {
  formatUsd,
  formatSignedUsd,
  formatPct,
  formatPrice,
  formatNumber,
  formatDateTime,
  baseAsset,
} from "@/lib/format";

export function TradeDesk({
  account,
  positions,
  trades,
  symbols,
}: {
  account: Account;
  positions: PositionRow[];
  trades: Trade[];
  symbols: string[];
}) {
  const [unrealized, setUnrealized] = useState(0);

  const realizedTotal = positions.reduce((s, p) => s + p.realizedPnl, 0);
  // Equity = cash + realized is already folded into cash at fill time, so
  // account equity = cash + unrealized mark-to-market of open positions.
  const equity = account.cash + unrealized;
  const totalReturn = equity - account.startingCash;
  const totalReturnPct = (totalReturn / account.startingCash) * 100;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg-0">Paper trading</h1>
        <p className="text-sm text-fg-1">
          Virtual {formatUsd(account.startingCash, 0)} account. Orders fill at the
          live market price; P&amp;L is marked to real-time prices.
        </p>
      </div>

      {/* Account summary */}
      <Panel title="Account">
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Stat label="Equity" value={formatUsd(equity)} />
          <Stat label="Cash" value={formatUsd(account.cash)} />
          <Stat
            label="Unrealized P&L"
            value={formatSignedUsd(unrealized)}
            valueClassName={signClass(unrealized)}
          />
          <Stat
            label="Total return"
            value={formatSignedUsd(totalReturn)}
            hint={formatPct(totalReturnPct)}
            valueClassName={signClass(totalReturn)}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Panel title="Open positions" bodyClassName="overflow-hidden">
            <PositionsTable positions={positions} onEquityChange={setUnrealized} />
          </Panel>

          <Panel title="Trade history" bodyClassName="overflow-hidden">
            {trades.length === 0 ? (
              <p className="p-6 text-sm text-fg-1">No trades yet.</p>
            ) : (
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-bg-1">
                    <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-fg-2">
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Market</th>
                      <th className="px-4 py-2 text-right font-medium">Side</th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">Price</th>
                      <th className="px-4 py-2 text-right font-medium">Realized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr key={t.id} className="border-b border-line/60 last:border-0">
                        <td className="tabular px-4 py-2 text-2xs text-fg-2">
                          {formatDateTime(t.executedAt)}
                        </td>
                        <td className="px-4 py-2 text-fg-0">{baseAsset(t.symbol)}</td>
                        <td className={`px-4 py-2 text-right capitalize ${t.side === "buy" ? "text-up" : "text-down"}`}>
                          {t.side}
                        </td>
                        <td className="tabular px-4 py-2 text-right text-fg-1">
                          {formatNumber(t.quantity, 6)}
                        </td>
                        <td className="tabular px-4 py-2 text-right text-fg-1">
                          {formatPrice(t.price)}
                        </td>
                        <td className={`tabular px-4 py-2 text-right ${signClass(t.realizedDelta)}`}>
                          {t.realizedDelta !== 0 ? formatSignedUsd(t.realizedDelta) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Order ticket" className="self-start">
          <OrderTicket symbols={symbols} cash={account.cash} />
        </Panel>
      </div>

      <p className="text-2xs text-fg-2">
        Realized P&amp;L total across all positions: {formatSignedUsd(realizedTotal)}.
        Paper trading only — no real funds are used.
      </p>
    </div>
  );
}
