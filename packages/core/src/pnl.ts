import type { OrderSide } from "./types.js";

/**
 * Average-cost position accounting for the paper-trading engine.
 *
 * The model is intentionally simple and deterministic so it can be unit-tested
 * against hand-computed scenarios and reproduced exactly on the server:
 *
 *  - A position has a signed `quantity` (positive = long, negative = short),
 *    an `avgPrice` (volume-weighted average entry of the *open* exposure), and
 *    accumulated `realizedPnl`.
 *  - A fill in the same direction as the open exposure increases the position
 *    and re-weights `avgPrice`.
 *  - A fill in the opposite direction reduces the position and realizes P&L on
 *    the closed quantity at `avgPrice`. If the fill exceeds the open quantity,
 *    the remainder flips the position and opens new exposure at the fill price.
 *
 * All amounts are in quote currency (e.g. USDT). Fees are supported as an
 * absolute quote-currency cost per fill and reduce realized P&L immediately.
 */
export interface Position {
  /** Signed: > 0 long, < 0 short, 0 flat. */
  quantity: number;
  /** Volume-weighted average entry price of the currently open quantity. */
  avgPrice: number;
  /** Cumulative realized P&L in quote currency (net of applied fees). */
  realizedPnl: number;
}

export interface Fill {
  side: OrderSide;
  /** Base-asset quantity, must be > 0. */
  quantity: number;
  /** Execution price in quote currency, must be > 0. */
  price: number;
  /** Optional flat fee in quote currency for this fill (default 0). */
  fee?: number;
}

export function emptyPosition(): Position {
  return { quantity: 0, avgPrice: 0, realizedPnl: 0 };
}

/**
 * Apply a single fill to a position, returning a new Position (pure function).
 */
export function applyFill(position: Position, fill: Fill): Position {
  if (!(fill.quantity > 0)) {
    throw new Error(`applyFill: fill.quantity must be > 0, received ${fill.quantity}`);
  }
  if (!(fill.price > 0)) {
    throw new Error(`applyFill: fill.price must be > 0, received ${fill.price}`);
  }

  const fee = fill.fee ?? 0;
  const signed = fill.side === "buy" ? fill.quantity : -fill.quantity;

  let { quantity, avgPrice, realizedPnl } = position;
  realizedPnl -= fee;

  const sameDirection =
    quantity === 0 || Math.sign(signed) === Math.sign(quantity);

  if (sameDirection) {
    // Increase exposure: re-weight average price.
    const newQty = quantity + signed;
    const totalCost = Math.abs(quantity) * avgPrice + Math.abs(signed) * fill.price;
    avgPrice = totalCost / Math.abs(newQty);
    quantity = newQty;
  } else {
    // Reduce / close / flip.
    const closing = Math.min(Math.abs(signed), Math.abs(quantity));
    const direction = Math.sign(quantity); // +1 closing a long, -1 closing a short
    // Realized P&L on the closed quantity:
    //  long  closed by sell: (sellPrice - avgPrice) * closing
    //  short closed by buy:  (avgPrice - buyPrice)  * closing
    realizedPnl += direction * (fill.price - avgPrice) * closing;

    const remaining = Math.abs(signed) - closing;
    quantity = quantity + signed;

    if (Math.abs(quantity) < 1e-12) {
      // Fully flat.
      quantity = 0;
      avgPrice = 0;
    } else if (remaining > 0) {
      // Flipped to the opposite side; new exposure opens at the fill price.
      avgPrice = fill.price;
    }
    // else: partially reduced, avgPrice unchanged.
  }

  return { quantity, avgPrice, realizedPnl };
}

/** Apply a sequence of fills in order. */
export function applyFills(position: Position, fills: Fill[]): Position {
  return fills.reduce(applyFill, position);
}

/**
 * Unrealized P&L of the open exposure marked at `markPrice`.
 * Long:  (mark - avg) * qty;  Short: (avg - mark) * |qty|. Both reduce to
 * (mark - avg) * quantity given the signed quantity.
 */
export function unrealizedPnl(position: Position, markPrice: number): number {
  if (position.quantity === 0) return 0;
  return (markPrice - position.avgPrice) * position.quantity;
}

/** Notional (absolute) market value of the open exposure at `markPrice`. */
export function notional(position: Position, markPrice: number): number {
  return Math.abs(position.quantity) * markPrice;
}

/** Total P&L = realized + unrealized at the given mark. */
export function totalPnl(position: Position, markPrice: number): number {
  return position.realizedPnl + unrealizedPnl(position, markPrice);
}
