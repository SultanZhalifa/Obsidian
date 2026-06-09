"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ServerMessage, Timeframe } from "@obsidian/core";
import { getGatewayClient } from "./ws-client.js";

/** Live connection status of the gateway WS. */
export function useGatewayStatus(): boolean {
  const [connected, setConnected] = useState(false);
  useEffect(() => getGatewayClient().onStatus(setConnected), []);
  return connected;
}

/** Subscribe a callback to all gateway messages, scoped to symbol+timeframe. */
export function useGatewayMessages(
  symbol: string,
  timeframe: Timeframe,
  onMessage: (msg: ServerMessage) => void,
): void {
  const cb = useRef(onMessage);
  cb.current = onMessage;

  useEffect(() => {
    const client = getGatewayClient();
    const unListen = client.addListener((msg) => cb.current(msg));
    const unSub = client.subscribe(symbol, timeframe);
    return () => {
      unListen();
      unSub();
    };
  }, [symbol, timeframe]);
}

export interface TickerState {
  price: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  /** +1 if last update ticked up, -1 down, 0 unchanged — drives flash anim. */
  dir: number;
}

/** Live ticker for a single symbol (subscribes on the symbol's base timeframe). */
export function useTicker(symbol: string, timeframe: Timeframe = "1m"): TickerState | null {
  const [state, setState] = useState<TickerState | null>(null);
  const lastPrice = useRef<number | null>(null);

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === "ticker" && msg.symbol === symbol.toUpperCase()) {
        const prev = lastPrice.current;
        const dir = prev == null ? 0 : Math.sign(msg.price - prev);
        lastPrice.current = msg.price;
        setState({
          price: msg.price,
          changePct: msg.changePct,
          high: msg.high,
          low: msg.low,
          volume: msg.volume,
          dir,
        });
      } else if (msg.type === "trade" && msg.symbol === symbol.toUpperCase()) {
        // Trades update price between 24h ticker pushes for a snappier feel.
        const prev = lastPrice.current;
        const dir = prev == null ? 0 : Math.sign(msg.price - prev);
        lastPrice.current = msg.price;
        setState((s) =>
          s ? { ...s, price: msg.price, dir } : null,
        );
      }
    },
    [symbol],
  );

  useGatewayMessages(symbol, timeframe, onMessage);
  return state;
}
