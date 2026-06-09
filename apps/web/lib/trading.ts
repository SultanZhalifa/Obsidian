import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@obsidian/db";
import {
  accounts,
  positions,
  trades,
  type Account,
  type PositionRow,
  type Trade,
} from "@obsidian/db/schema";
import {
  applyFill,
  emptyPosition,
  type OrderSide,
  type Position,
} from "@obsidian/core";
import { serverEnv } from "./env.js";

/** Taker fee applied to paper fills, matching a realistic 0.1% exchange fee. */
const FEE_RATE = 0.001;

export interface OrderResult {
  ok: boolean;
  error?: string;
  fillPrice?: number;
}

/** Fetch a real, current execution price from Binance public REST. */
async function getMarkPrice(symbol: string): Promise<number> {
  const url = new URL("/api/v3/ticker/price", serverEnv.binanceRest);
  url.searchParams.set("symbol", symbol.toUpperCase());
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`price ${symbol}: ${res.status}`);
  const data = (await res.json()) as { price: string };
  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("invalid price");
  return price;
}

function rowToPosition(row: PositionRow | undefined): Position {
  if (!row) return emptyPosition();
  return {
    quantity: row.quantity,
    avgPrice: row.avgPrice,
    realizedPnl: row.realizedPnl,
  };
}

/**
 * Execute a paper market order at the live price. Runs in a serializable
 * transaction: re-reads the account + position, applies the fill via the core
 * P&L engine, checks affordability, then persists the trade, updated position
 * and new cash balance atomically.
 *
 * Cash model: buying spends quote currency (qty*price + fee); selling/closing
 * a long returns it. Shorting is allowed; closing a short spends cash to buy
 * back. Cash must never go negative.
 */
export async function executeOrder(
  userId: string,
  symbol: string,
  side: OrderSide,
  quantity: number,
): Promise<OrderResult> {
  let price: number;
  try {
    price = await getMarkPrice(symbol);
  } catch {
    return { ok: false, error: "Could not fetch a live price. Try again." };
  }

  const notional = quantity * price;
  const fee = notional * FEE_RATE;

  try {
    await db.transaction(async (tx) => {
      const accountRows = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .limit(1);
      const account = accountRows[0];
      if (!account) throw new OrderError("No trading account found.");

      const posRows = await tx
        .select()
        .from(positions)
        .where(and(eq(positions.accountId, account.id), eq(positions.symbol, symbol)))
        .limit(1);
      const before = rowToPosition(posRows[0]);

      // Cash impact: a buy of `quantity` costs notional + fee; a sell credits
      // notional - fee. This holds for opening, closing, and flipping because
      // notional is always |qty| * price of the traded amount.
      const cashDelta = side === "buy" ? -(notional + fee) : notional - fee;
      const newCash = account.cash + cashDelta;
      if (newCash < 0) {
        throw new OrderError("Insufficient cash for this order.");
      }

      const after = applyFill(before, { side, quantity, price, fee });

      // Persist trade (immutable record). realizedDelta is this fill's
      // contribution to realized P&L (already net of fee, since the core engine
      // subtracts the fee into realizedPnl).
      await tx.insert(trades).values({
        accountId: account.id,
        symbol,
        side,
        quantity,
        price,
        fee,
        realizedDelta: after.realizedPnl - before.realizedPnl,
      });

      // Upsert position.
      if (posRows[0]) {
        await tx
          .update(positions)
          .set({
            quantity: after.quantity,
            avgPrice: after.avgPrice,
            realizedPnl: after.realizedPnl,
            updatedAt: new Date(),
          })
          .where(eq(positions.id, posRows[0].id));
      } else {
        await tx.insert(positions).values({
          accountId: account.id,
          symbol,
          quantity: after.quantity,
          avgPrice: after.avgPrice,
          realizedPnl: after.realizedPnl,
        });
      }

      // Update cash.
      await tx
        .update(accounts)
        .set({ cash: newCash })
        .where(eq(accounts.id, account.id));
    });
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, error: err.message };
    return { ok: false, error: "Order failed. Please try again." };
  }

  return { ok: true, fillPrice: price };
}

class OrderError extends Error {}

// --- Read helpers ----------------------------------------------------------

export async function getAccount(userId: string): Promise<Account | null> {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPositions(accountId: string): Promise<PositionRow[]> {
  return db
    .select()
    .from(positions)
    .where(eq(positions.accountId, accountId))
    .orderBy(desc(positions.updatedAt));
}

export async function getTrades(accountId: string, limit = 50): Promise<Trade[]> {
  return db
    .select()
    .from(trades)
    .where(eq(trades.accountId, accountId))
    .orderBy(desc(trades.executedAt))
    .limit(limit);
}

/**
 * Reconstruct the account equity curve from the immutable trade log: starting
 * cash plus cumulative realized P&L over time. Returns oldest-first points.
 * (Pure realized curve; unrealized is layered on the client from live marks.)
 */
export async function getRealizedEquityCurve(
  accountId: string,
  startingCash: number,
): Promise<{ time: number; equity: number }[]> {
  const rows = await db
    .select({
      executedAt: trades.executedAt,
      realizedDelta: trades.realizedDelta,
    })
    .from(trades)
    .where(eq(trades.accountId, accountId))
    .orderBy(trades.executedAt);

  let equity = startingCash;
  return rows.map((r) => {
    equity += r.realizedDelta;
    return { time: r.executedAt.getTime(), equity };
  });
}

/** Convenience: get the set of distinct symbols the account holds or traded. */
export async function getHeldSymbols(accountId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ symbol: positions.symbol })
    .from(positions)
    .where(eq(positions.accountId, accountId));
  return rows.map((r) => r.symbol);
}
