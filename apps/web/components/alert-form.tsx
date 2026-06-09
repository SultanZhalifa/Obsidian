"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AlertKind } from "@obsidian/core";
import { TIMEFRAMES } from "@obsidian/core";
import { prettySymbol } from "@/lib/format";
import { useToast } from "./toast";
import { createAlertAction, type AlertActionState } from "@/app/(app)/alerts/actions";

const KINDS: { value: AlertKind; label: string }[] = [
  { value: "price_above", label: "Price rises above" },
  { value: "price_below", label: "Price falls below" },
  { value: "rsi_above", label: "RSI rises above" },
  { value: "rsi_below", label: "RSI falls below" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Creating…" : "Create alert"}
    </button>
  );
}

export function AlertForm({ symbols }: { symbols: string[] }) {
  const [kind, setKind] = useState<AlertKind>("price_above");
  const isRsi = kind.startsWith("rsi_");
  const { push } = useToast();

  const [state, formAction] = useActionState<AlertActionState, FormData>(
    createAlertAction,
    {},
  );

  useEffect(() => {
    if (state.ok) push({ kind: "success", title: "Alert created" });
    else if (state.error) push({ kind: "warning", title: "Could not create alert", body: state.error });
  }, [state, push]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div>
        <label className="label" htmlFor="alert-symbol">Market</label>
        <select id="alert-symbol" name="symbol" className="input">
          {symbols.map((s) => (
            <option key={s} value={s}>{prettySymbol(s)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="alert-kind">Condition</label>
        <select
          id="alert-kind"
          name="kind"
          className="input"
          value={kind}
          onChange={(e) => setKind(e.target.value as AlertKind)}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="alert-threshold">
          {isRsi ? "RSI level (0–100)" : "Price"}
        </label>
        <input
          id="alert-threshold"
          name="threshold"
          type="number"
          step="any"
          min="0"
          max={isRsi ? "100" : undefined}
          className="input tabular"
          required
          placeholder={isRsi ? "70" : "70000"}
        />
      </div>

      <div className={isRsi ? "" : "opacity-40"}>
        <label className="label" htmlFor="alert-tf">Timeframe</label>
        <select id="alert-tf" name="timeframe" className="input" disabled={!isRsi}>
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
      </div>

      <SubmitButton />
    </form>
  );
}
