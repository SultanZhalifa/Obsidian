import { createServer } from "node:http";
import { ema, macd, rsi, type Candle, type Timeframe } from "@obsidian/core";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { BinanceStream, fetchKlines } from "./binance.js";
import { MarketState } from "./market-state.js";
import { persistCandle, dbHealthy } from "./persistence.js";
import { AlertsRunner } from "./alerts-runner.js";
import { Hub } from "./hub.js";

const startedAt = Date.now();
let binanceConnected = false;

const state = new MarketState();
const hub = new Hub(config.wsPath);

const alertsRunner = new AlertsRunner(({ alert, value }) => {
  // Notify all clients of a triggered alert. The browser filters by userId so a
  // user only surfaces their own triggers; the trigger is also persisted, so a
  // disconnected user still sees it on next load.
  hub.broadcastAll({
    type: "alert",
    alertId: alert.id,
    userId: alert.userId,
    symbol: alert.symbol,
    kind: alert.kind,
    threshold: alert.threshold,
    value,
    at: Date.now(),
  });
  logger.info({ alertId: alert.id, value }, "broadcast alert trigger");
});

/** Compute and broadcast the latest indicator snapshot for a closed series. */
function emitIndicators(symbol: string, timeframe: Timeframe, series: Candle[]): void {
  if (series.length < 35) return; // need enough history for MACD/RSI
  const closes = series.map((c) => c.close);
  const rsiSeries = rsi(closes, 14);
  const ema12Series = ema(closes, 12);
  const ema26Series = ema(closes, 26);
  const macdSeries = macd(closes, 12, 26, 9);

  const i = series.length - 1;
  const rsiVal = rsiSeries[i] ?? null;
  const macdVal = macdSeries[i];

  hub.broadcastSymbolTimeframe(symbol, timeframe, {
    type: "indicators",
    symbol: symbol.toUpperCase(),
    timeframe,
    rsi: rsiVal,
    ema12: ema12Series[i] ?? null,
    ema26: ema26Series[i] ?? null,
    macd: macdVal ? macdVal.macd : null,
    signal: macdVal ? macdVal.signal : null,
    at: Date.now(),
  });

  if (rsiVal !== null) alertsRunner.evaluateRsi(symbol, timeframe, rsiVal);
}

const stream = new BinanceStream(config.symbols, config.timeframes, {
  onStatusChange(connected) {
    binanceConnected = connected;
  },

  onTrade(symbol, price, qty, buyerMaker, at) {
    state.setLastPrice(symbol, price);
    hub.broadcastSymbol(symbol, {
      type: "trade",
      symbol: symbol.toUpperCase(),
      price,
      quantity: qty,
      // buyerMaker = the buyer was the maker => the trade was a market SELL.
      side: buyerMaker ? "sell" : "buy",
      at,
    });
    alertsRunner.evaluatePrice(symbol, price);
  },

  onKline(symbol, timeframe, candle, closed) {
    const series = state.upsert(symbol, timeframe, candle);
    hub.broadcastSymbolTimeframe(symbol, timeframe, {
      type: "kline",
      symbol: symbol.toUpperCase(),
      timeframe,
      candle,
      closed,
    });
    if (closed) {
      void persistCandle(symbol, timeframe, candle);
      emitIndicators(symbol, timeframe, series);
    }
  },

  onDepth(symbol, bids, asks, at) {
    hub.broadcastSymbol(symbol, {
      type: "depth",
      symbol: symbol.toUpperCase(),
      bids,
      asks,
      at,
    });
  },

  onTicker(symbol, price, changePct, high, low, volume, at) {
    state.setLastPrice(symbol, price);
    hub.broadcastSymbol(symbol, {
      type: "ticker",
      symbol: symbol.toUpperCase(),
      price,
      changePct,
      high,
      low,
      volume,
      at,
    });
  },
});

async function backfill(): Promise<void> {
  for (const symbol of config.symbols) {
    for (const tf of config.timeframes) {
      try {
        const candles = await fetchKlines(symbol, tf);
        state.seed(symbol, tf, candles);
        // Persist the closed historical candles (all but the most recent open one).
        const closed = candles.slice(0, -1);
        for (const c of closed) {
          await persistCandle(symbol, tf, c);
        }
        logger.info(
          { symbol, tf, count: candles.length },
          "backfilled historical candles",
        );
      } catch (err) {
        logger.error(
          { err: (err as Error).message, symbol, tf },
          "backfill failed",
        );
      }
    }
  }
}

// --- HTTP server (health + WS upgrade) ------------------------------------

const http = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/health" || url.pathname === "/api/health") {
    void dbHealthy().then((db) => {
      const healthy = db; // DB must be reachable; Binance status reported separately
      res.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: healthy ? "ok" : "degraded",
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          db,
          binanceConnected,
          clients: hub.clientCount(),
          symbols: config.symbols,
          timeframes: config.timeframes,
        }),
      );
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

http.on("upgrade", (req, socket, head) => {
  hub.handleUpgrade(req, socket, head);
});

async function main(): Promise<void> {
  // Listen and connect to the live feed immediately so /health and the WS
  // fan-out are available right away; backfill runs in the background and only
  // affects historical persistence + indicator warm-up, not liveness.
  http.listen(config.port, () => {
    logger.info(
      { port: config.port, wsPath: config.wsPath },
      "market-gateway listening",
    );
  });
  stream.start();

  if (config.databaseUrl) {
    await alertsRunner.start();
    backfill().catch((err) =>
      logger.error({ err: (err as Error).message }, "backfill error"),
    );
  } else {
    logger.warn("DATABASE_URL not set; running without persistence/alerts");
  }
}

function shutdown(): void {
  logger.info("shutting down");
  stream.stop();
  alertsRunner.stop();
  hub.close();
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  logger.error({ err: (err as Error).message }, "fatal startup error");
  process.exit(1);
});
