import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import {
  clientMessageSchema,
  type ServerMessage,
  type Timeframe,
} from "@obsidian/core";
import { logger } from "./logger.js";

interface Subscription {
  symbol: string; // lowercase
  timeframe: Timeframe;
}

interface Client {
  socket: WebSocket;
  subs: Set<string>; // `${symbol}:${timeframe}`
  alive: boolean;
}

function subKey(symbol: string, tf: Timeframe): string {
  return `${symbol.toLowerCase()}:${tf}`;
}

/**
 * Our own WebSocket fan-out hub. Browsers connect here (not to Binance) and
 * subscribe to per-symbol topics. The hub routes gateway-produced messages to
 * the clients that asked for them. Ticker, depth and trade messages are routed
 * by symbol; kline and indicator messages by symbol+timeframe.
 */
export interface HubHooks {
  /** Called when the first client starts following a symbol. */
  onSymbolNeeded?(symbol: string): void;
  /** Called when the last client stops following a symbol. */
  onSymbolIdle?(symbol: string): void;
}

export class Hub {
  private wss: WebSocketServer;
  private clients = new Set<Client>();
  private heartbeat: NodeJS.Timeout;
  /** Reference count of clients following each symbol (lowercase). */
  private symbolRefs = new Map<string, number>();
  private hooks: HubHooks;

  constructor(path: string, hooks: HubHooks = {}) {
    this.wss = new WebSocketServer({ noServer: true });
    this.path = path;
    this.hooks = hooks;

    this.wss.on("connection", (socket: WebSocket) => {
      const client: Client = { socket, subs: new Set(), alive: true };
      this.clients.add(client);
      logger.info({ clients: this.clients.size }, "client connected");

      socket.on("pong", () => {
        client.alive = true;
      });

      socket.on("message", (data) => this.onClientMessage(client, data.toString()));

      socket.on("close", () => {
        // Release every symbol this client was following.
        for (const sym of this.clientSymbols(client)) this.releaseSymbol(sym);
        this.clients.delete(client);
        logger.info({ clients: this.clients.size }, "client disconnected");
      });

      socket.on("error", () => {
        this.clients.delete(client);
      });
    });

    // Detect and drop dead clients.
    this.heartbeat = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) {
          client.socket.terminate();
          this.clients.delete(client);
          continue;
        }
        client.alive = false;
        if (client.socket.readyState === WebSocket.OPEN) client.socket.ping();
      }
    }, 30_000);
  }

  readonly path: string;

  /** Upgrade an HTTP request onto the WS server if the path matches. */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== this.path) {
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  private onClientMessage(client: Client, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const result = clientMessageSchema.safeParse(parsed);
    if (!result.success) return;
    const msg = result.data;

    if (msg.type === "ping") {
      this.send(client, { type: "pong" });
      return;
    }
    const sym = msg.symbol.toLowerCase();
    const key = subKey(msg.symbol, msg.timeframe as Timeframe);

    if (msg.type === "subscribe") {
      const hadSymbol = this.clientHasSymbol(client, sym);
      client.subs.add(key);
      // Only acquire the symbol once per client (across all its timeframes).
      if (!hadSymbol) this.acquireSymbol(sym);
    } else {
      client.subs.delete(key);
      if (!this.clientHasSymbol(client, sym)) this.releaseSymbol(sym);
    }
  }

  /** Distinct lowercase symbols this client currently follows. */
  private clientSymbols(client: Client): Set<string> {
    const out = new Set<string>();
    for (const sub of client.subs) {
      const sym = sub.split(":")[0];
      if (sym) out.add(sym);
    }
    return out;
  }

  private clientHasSymbol(client: Client, sym: string): boolean {
    const prefix = `${sym}:`;
    for (const sub of client.subs) if (sub.startsWith(prefix)) return true;
    return false;
  }

  /** Increment a symbol's ref-count; fire onSymbolNeeded on the first ref. */
  private acquireSymbol(sym: string): void {
    const next = (this.symbolRefs.get(sym) ?? 0) + 1;
    this.symbolRefs.set(sym, next);
    if (next === 1) this.hooks.onSymbolNeeded?.(sym);
  }

  /** Decrement a symbol's ref-count; fire onSymbolIdle when it hits zero. */
  private releaseSymbol(sym: string): void {
    const next = (this.symbolRefs.get(sym) ?? 1) - 1;
    if (next <= 0) {
      this.symbolRefs.delete(sym);
      this.hooks.onSymbolIdle?.(sym);
    } else {
      this.symbolRefs.set(sym, next);
    }
  }

  private send(client: Client, message: ServerMessage): void {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    client.socket.send(JSON.stringify(message));
  }

  /** Broadcast a message to clients subscribed to any timeframe of `symbol`. */
  broadcastSymbol(symbol: string, message: ServerMessage): void {
    const prefix = `${symbol.toLowerCase()}:`;
    for (const client of this.clients) {
      for (const sub of client.subs) {
        if (sub.startsWith(prefix)) {
          this.send(client, message);
          break;
        }
      }
    }
  }

  /** Broadcast to clients subscribed to a specific symbol+timeframe. */
  broadcastSymbolTimeframe(
    symbol: string,
    timeframe: Timeframe,
    message: ServerMessage,
  ): void {
    const key = subKey(symbol, timeframe);
    for (const client of this.clients) {
      if (client.subs.has(key)) this.send(client, message);
    }
  }

  /** Broadcast to every connected client regardless of subscription. */
  broadcastAll(message: ServerMessage): void {
    for (const client of this.clients) this.send(client, message);
  }

  clientCount(): number {
    return this.clients.size;
  }

  close(): void {
    clearInterval(this.heartbeat);
    this.wss.close();
  }
}
