import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@obsidian/db";
import { watchlist } from "@obsidian/db/schema";

/** Default symbols seeded into a new user's watchlist. */
export const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
];

const MAX_WATCHLIST = 30;

/** Ordered list of a user's followed symbols. */
export async function getWatchlist(userId: string): Promise<string[]> {
  const rows = await db
    .select({ symbol: watchlist.symbol })
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(asc(watchlist.sortOrder), asc(watchlist.createdAt));
  return rows.map((r) => r.symbol);
}

/**
 * Ensure a user has a watchlist, seeding the defaults on first access. Returns
 * the resulting ordered symbol list. Idempotent.
 */
export async function ensureWatchlist(userId: string): Promise<string[]> {
  const existing = await getWatchlist(userId);
  if (existing.length > 0) return existing;
  await db
    .insert(watchlist)
    .values(
      DEFAULT_WATCHLIST.map((symbol, i) => ({ userId, symbol, sortOrder: i })),
    )
    .onConflictDoNothing();
  return getWatchlist(userId);
}

export type AddResult =
  | { ok: true }
  | { ok: false; error: string };

/** Add a symbol to the user's watchlist (deduped, capped). */
export async function addToWatchlist(
  userId: string,
  symbol: string,
): Promise<AddResult> {
  const current = await getWatchlist(userId);
  if (current.includes(symbol)) return { ok: false, error: "Already in your watchlist." };
  if (current.length >= MAX_WATCHLIST) {
    return { ok: false, error: `Watchlist is full (max ${MAX_WATCHLIST}).` };
  }
  await db
    .insert(watchlist)
    .values({ userId, symbol, sortOrder: current.length })
    .onConflictDoNothing();
  return { ok: true };
}

/** Remove a symbol from the user's watchlist. */
export async function removeFromWatchlist(
  userId: string,
  symbol: string,
): Promise<void> {
  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol)));
}
