import { z } from "zod";
import { TIMEFRAMES } from "./types.js";

/** Binance symbols we accept: 6-20 uppercase alphanumerics, e.g. BTCUSDT. */
export const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,20}$/, "Invalid symbol");

export const timeframeSchema = z.enum(
  TIMEFRAMES as unknown as [string, ...string[]],
);

export const orderSideSchema = z.enum(["buy", "sell"]);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(200),
  displayName: z.string().trim().min(1).max(60).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Paper-trading orders
// ---------------------------------------------------------------------------

export const placeOrderSchema = z.object({
  symbol: symbolSchema,
  side: orderSideSchema,
  /** Base-asset quantity. Positive, bounded to keep paper books sane. */
  quantity: z.number().positive().finite().max(1_000_000),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const alertKindSchema = z.enum([
  "price_above",
  "price_below",
  "rsi_above",
  "rsi_below",
]);

export const createAlertSchema = z
  .object({
    symbol: symbolSchema,
    kind: alertKindSchema,
    /** Threshold value: a price for price_* , an RSI level (0-100) for rsi_*. */
    threshold: z.number().finite(),
    /** Required for rsi_* alerts; ignored for price_* . */
    timeframe: timeframeSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind.startsWith("rsi_")) {
      if (val.timeframe === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["timeframe"],
          message: "timeframe is required for RSI alerts",
        });
      }
      if (val.threshold < 0 || val.threshold > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["threshold"],
          message: "RSI threshold must be between 0 and 100",
        });
      }
    } else if (val.threshold <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["threshold"],
        message: "Price threshold must be greater than 0",
      });
    }
  });

export type AlertKind = z.infer<typeof alertKindSchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

// ---------------------------------------------------------------------------
// Gateway WebSocket protocol (client <-> gateway)
// ---------------------------------------------------------------------------

/** Messages the browser sends to the gateway. */
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    symbol: symbolSchema,
    timeframe: timeframeSchema,
  }),
  z.object({
    type: z.literal("unsubscribe"),
    symbol: symbolSchema,
    timeframe: timeframeSchema,
  }),
  z.object({ type: z.literal("ping") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

/** Messages the gateway pushes to the browser. */
export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ticker"),
    symbol: symbolSchema,
    price: z.number(),
    changePct: z.number(),
    high: z.number(),
    low: z.number(),
    volume: z.number(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("kline"),
    symbol: symbolSchema,
    timeframe: timeframeSchema,
    candle: candleSchema,
    closed: z.boolean(),
  }),
  z.object({
    type: z.literal("depth"),
    symbol: symbolSchema,
    bids: z.array(z.tuple([z.number(), z.number()])),
    asks: z.array(z.tuple([z.number(), z.number()])),
    at: z.number(),
  }),
  z.object({
    type: z.literal("trade"),
    symbol: symbolSchema,
    price: z.number(),
    quantity: z.number(),
    side: orderSideSchema,
    at: z.number(),
  }),
  z.object({
    type: z.literal("indicators"),
    symbol: symbolSchema,
    timeframe: timeframeSchema,
    rsi: z.number().nullable(),
    ema12: z.number().nullable(),
    ema26: z.number().nullable(),
    macd: z.number().nullable(),
    signal: z.number().nullable(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("alert"),
    alertId: z.string(),
    userId: z.string(),
    symbol: symbolSchema,
    kind: alertKindSchema,
    threshold: z.number(),
    value: z.number(),
    at: z.number(),
  }),
  z.object({ type: z.literal("pong") }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
