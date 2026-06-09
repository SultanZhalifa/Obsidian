"use client";

import {
  serverMessageSchema,
  type ClientMessage,
  type ServerMessage,
  type Timeframe,
} from "@obsidian/core";
import { publicEnv } from "./env.js";

type Listener = (msg: ServerMessage) => void;

interface SubRef {
  symbol: string;
  timeframe: Timeframe;
}

function subKey(s: string, tf: Timeframe) {
  return `${s.toUpperCase()}:${tf}`;
}

/**
 * Singleton browser WebSocket client for the gateway fan-out.
 *
 * - One shared connection for the whole tab (many components subscribe).
 * - Auto-reconnect with exponential backoff; re-sends all active subscriptions
 *   on reconnect so consumers never have to re-subscribe.
 * - Reference-counts subscriptions so a topic is only unsubscribed upstream
 *   when the last consumer leaves.
 */
class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = new Set<Listener>();
  private subCounts = new Map<string, number>();
  private subRefs = new Map<string, SubRef>();
  private backoff = 1000;
  private connected = false;
  private statusListeners = new Set<(connected: boolean) => void>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  private ensureOpen() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.connected = true;
      this.emitStatus();
      // Re-subscribe everything.
      for (const ref of this.subRefs.values()) {
        this.send({ type: "subscribe", symbol: ref.symbol, timeframe: ref.timeframe });
      }
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), 25_000);
    };

    ws.onmessage = (ev) => {
      let data: unknown;
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      const parsed = serverMessageSchema.safeParse(data);
      if (!parsed.success) return;
      for (const l of this.listeners) l(parsed.data);
    };

    ws.onclose = () => {
      this.connected = false;
      this.emitStatus();
      if (this.pingTimer) clearInterval(this.pingTimer);
      setTimeout(() => this.ensureOpen(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, 15_000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private emitStatus() {
    for (const l of this.statusListeners) l(this.connected);
  }

  onStatus(cb: (connected: boolean) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.connected);
    return () => this.statusListeners.delete(cb);
  }

  addListener(l: Listener): () => void {
    this.listeners.add(l);
    this.ensureOpen();
    return () => this.listeners.delete(l);
  }

  subscribe(symbol: string, timeframe: Timeframe): () => void {
    this.ensureOpen();
    const key = subKey(symbol, timeframe);
    const next = (this.subCounts.get(key) ?? 0) + 1;
    this.subCounts.set(key, next);
    if (next === 1) {
      this.subRefs.set(key, { symbol: symbol.toUpperCase(), timeframe });
      this.send({ type: "subscribe", symbol, timeframe });
    }
    return () => {
      const count = (this.subCounts.get(key) ?? 1) - 1;
      if (count <= 0) {
        this.subCounts.delete(key);
        this.subRefs.delete(key);
        this.send({ type: "unsubscribe", symbol, timeframe });
      } else {
        this.subCounts.set(key, count);
      }
    };
  }
}

let client: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient {
  if (!client) client = new GatewayClient(publicEnv.gatewayWsUrl);
  return client;
}
