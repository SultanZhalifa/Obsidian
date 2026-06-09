"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { OrderSide } from "@obsidian/core";
import { useTicker } from "@/lib/use-market";
import { formatPrice, formatUsd, prettySymbol, baseAsset } from "@/lib/format";
import { useToast } from "./toast";
import { placeOrderAction, type OrderActionState } from "@/app/(app)/trade/actions";

function SubmitButton({ side }: { side: OrderSide }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        "btn w-full border-transparent font-semibold",
        side === "buy"
          ? "bg-up/20 text-up hover:bg-up/30"
          : "bg-down/20 text-down hover:bg-down/30",
      )}
    >
      {pending ? "Placing…" : side === "buy" ? "Buy / Long" : "Sell / Short"}
    </button>
  );
}

export function OrderTicket({
  symbols,
  cash,
}: {
  symbols: string[];
  cash: number;
}) {
  const [symbol, setSymbol] = useState(symbols[0] ?? "BTCUSDT");
  const [side, setSide] = useState<OrderSide>("buy");
  const [qty, setQty] = useState("0.01");
  const { push } = useToast();

  const ticker = useTicker(symbol);
  const price = ticker?.price ?? 0;

  const [state, formAction] = useActionState<OrderActionState, FormData>(
    placeOrderAction,
    {},
  );

  useEffect(() => {
    if (state.ok && state.message) {
      push({ kind: "success", title: "Order filled", body: state.message });
    } else if (state.error) {
      push({ kind: "warning", title: "Order rejected", body: state.error });
    }
    // Only react to a new result object.
  }, [state, push]);

  const quantity = Number(qty) || 0;
  const estCost = useMemo(() => quantity * price, [quantity, price]);
  const fee = estCost * 0.001;

  return (
    <form action={formAction} className="flex flex-col gap-4 p-4">
      <input type="hidden" name="symbol" value={symbol} />
      <input type="hidden" name="side" value={side} />

      <div>
        <label className="label" htmlFor="ticket-symbol">
          Market
        </label>
        <select
          id="ticket-symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="input"
        >
          {symbols.map((s) => (
            <option key={s} value={s}>
              {prettySymbol(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between rounded border border-line bg-bg-2 px-3 py-2">
        <span className="text-2xs uppercase tracking-wide text-fg-2">Live price</span>
        <span
          className={clsx(
            "tabular text-sm font-semibold text-fg-0",
            ticker?.dir === 1 && "animate-flash-up",
            ticker?.dir === -1 && "animate-flash-down",
          )}
        >
          {price ? formatPrice(price) : "—"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            aria-pressed={side === s}
            className={clsx(
              "rounded border px-3 py-2 text-sm font-medium capitalize transition-colors",
              side === s
                ? s === "buy"
                  ? "border-up/50 bg-up/10 text-up"
                  : "border-down/50 bg-down/10 text-down"
                : "border-line text-fg-1 hover:bg-bg-2",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="ticket-qty">
          Quantity ({baseAsset(symbol)})
        </label>
        <input
          id="ticket-qty"
          name="quantity"
          type="number"
          step="any"
          min="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="input tabular"
          required
        />
        <div className="mt-2 flex gap-1">
          {[0.25, 0.5, 0.75, 1].map((frac) => (
            <button
              key={frac}
              type="button"
              onClick={() => {
                if (price > 0) setQty(((cash * frac) / price).toFixed(6));
              }}
              className="flex-1 rounded border border-line py-1 text-2xs text-fg-1 hover:bg-bg-2"
            >
              {frac * 100}%
            </button>
          ))}
        </div>
      </div>

      <dl className="flex flex-col gap-1 border-t border-line pt-3 text-xs">
        <div className="flex justify-between">
          <dt className="text-fg-2">Order value</dt>
          <dd className="tabular text-fg-1">{formatUsd(estCost)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-2">Est. fee (0.1%)</dt>
          <dd className="tabular text-fg-1">{formatUsd(fee)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-2">Available cash</dt>
          <dd className="tabular text-fg-1">{formatUsd(cash)}</dd>
        </div>
      </dl>

      <SubmitButton side={side} />
    </form>
  );
}
