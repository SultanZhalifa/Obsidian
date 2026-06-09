/** Public, build-time-safe runtime config for the browser. */
export const publicEnv = {
  gatewayWsUrl:
    process.env.NEXT_PUBLIC_GATEWAY_WS_URL ?? "ws://localhost:8080/stream",
};

/** Server-only config. */
export const serverEnv = {
  binanceRest: process.env.BINANCE_REST_BASE ?? "https://data-api.binance.vision",
  gatewayHttpUrl: process.env.GATEWAY_HTTP_URL ?? "http://localhost:8080",
};

/** The symbols surfaced in the UI watchlist (must match gateway SYMBOLS). */
export const WATCHLIST = (
  process.env.NEXT_PUBLIC_SYMBOLS ?? "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT"
)
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
