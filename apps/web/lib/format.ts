/**
 * Number / price / percentage formatting helpers. All produce locale-stable,
 * tabular-friendly strings so figures line up in monospace columns.
 */

/** Choose a sensible price precision based on magnitude (crypto-friendly). */
export function priceDecimals(price: number): number {
  const abs = Math.abs(price);
  if (abs >= 1000) return 2;
  if (abs >= 1) return 2;
  if (abs >= 0.01) return 4;
  return 6;
}

export function formatPrice(price: number, decimals?: number): string {
  if (!Number.isFinite(price)) return "—";
  const d = decimals ?? priceDecimals(price);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatUsd(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `$${formatNumber(value, decimals)}`;
}

export function formatSignedUsd(value: number, decimals = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${formatNumber(Math.abs(value), decimals)}`;
}

export function formatPct(pct: number, decimals = 2): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(decimals)}%`;
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

/** "BTCUSDT" -> "BTC / USDT" (best-effort split on common quote assets). */
export function prettySymbol(symbol: string): string {
  const quotes = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH", "EUR"];
  const upper = symbol.toUpperCase();
  for (const q of quotes) {
    if (upper.endsWith(q) && upper.length > q.length) {
      return `${upper.slice(0, -q.length)} / ${q}`;
    }
  }
  return upper;
}

export function baseAsset(symbol: string): string {
  const quotes = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH", "EUR"];
  const upper = symbol.toUpperCase();
  for (const q of quotes) {
    if (upper.endsWith(q) && upper.length > q.length) return upper.slice(0, -q.length);
  }
  return upper;
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour12: false });
}

export function formatDateTime(d: Date | string | number): string {
  return new Date(d).toLocaleString("en-US", { hour12: false });
}
