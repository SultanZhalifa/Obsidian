"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { SymbolInfo } from "@/lib/market";
import {
  searchSymbolsAction,
  addSymbolAction,
} from "@/app/(app)/dashboard/actions";
import { IconSearch, IconX, IconArrowUp } from "./icons";
import { useToast } from "./toast";

/**
 * Add-symbol dialog: debounced server-side search over Binance's tradable USDT
 * pairs, with one-click add. Closes on Escape or backdrop click.
 */
export function SymbolSearch({
  existing,
  onClose,
}: {
  existing: string[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const existingSet = new Set(existing);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced search.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchSymbolsAction(query);
      if (active) {
        setResults(res);
        setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  function add(symbol: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("symbol", symbol);
      const result = await addSymbolAction({}, fd);
      if (result.ok) {
        push({ kind: "success", title: "Added", body: `${symbol} added to your watchlist.` });
        onClose();
      } else {
        push({ kind: "warning", title: "Couldn't add", body: result.error });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add a market"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-line bg-bg-1 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <IconSearch size={18} className="text-fg-2" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets (e.g. BTC, SOL, DOGE)…"
            className="flex-1 bg-transparent text-sm text-fg-0 placeholder:text-fg-2 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded p-1 text-fg-2 hover:bg-bg-3 hover:text-fg-0"
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && results.length === 0 ? (
            <p className="p-4 text-sm text-fg-2">Searching…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-fg-2">No markets found.</p>
          ) : (
            <ul>
              {results.map((s) => {
                const added = existingSet.has(s.symbol);
                return (
                  <li key={s.symbol}>
                    <button
                      disabled={added || pending}
                      onClick={() => add(s.symbol)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-bg-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-bg-2 text-2xs font-semibold text-fg-0">
                          {s.baseAsset.slice(0, 3)}
                        </span>
                        <span className="text-sm font-medium text-fg-0">
                          {s.baseAsset}
                          <span className="text-fg-2">/{s.quoteAsset}</span>
                        </span>
                      </span>
                      <span className="text-2xs uppercase tracking-wide text-fg-2">
                        {added ? "Added" : "Add"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-2xs text-fg-2">
          <span>Live USDT spot markets · Binance</span>
          <span className="flex items-center gap-1">
            <IconArrowUp size={11} className="rotate-45" /> Esc to close
          </span>
        </div>
      </div>
    </div>
  );
}
