import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  doublePrecision,
  bigint,
  boolean,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["admin", "trader"]);
export const orderSide = pgEnum("order_side", ["buy", "sell"]);
export const alertKind = pgEnum("alert_kind", [
  "price_above",
  "price_below",
  "rsi_above",
  "rsi_below",
]);
export const alertStatus = pgEnum("alert_status", [
  "active",
  "triggered",
  "disabled",
]);

// ---------------------------------------------------------------------------
// Auth: users + sessions
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    displayName: varchar("display_name", { length: 60 }),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("trader"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => ({
    emailUnique: uniqueIndex("users_email_unique").on(t.email),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // opaque random token id (hashed at rest)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
  }),
);

// ---------------------------------------------------------------------------
// Paper-trading: accounts, trades, positions
// ---------------------------------------------------------------------------

/** One virtual cash account per user (quote currency = USDT). */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Cash balance in quote currency. */
  cash: doublePrecision("cash").notNull().default(100_000),
  /** Starting equity, kept for return-since-inception calculations. */
  startingCash: doublePrecision("starting_cash").notNull().default(100_000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Immutable record of every executed paper fill. */
export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    side: orderSide("side").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    price: doublePrecision("price").notNull(),
    fee: doublePrecision("fee").notNull().default(0),
    /** Realized P&L attributed to this fill (0 for opening/adding fills). */
    realizedDelta: doublePrecision("realized_delta").notNull().default(0),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountIdx: index("trades_account_idx").on(t.accountId, t.executedAt),
    symbolIdx: index("trades_symbol_idx").on(t.symbol),
  }),
);

/** Current open position per account+symbol (the running aggregate of fills). */
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    quantity: doublePrecision("quantity").notNull().default(0),
    avgPrice: doublePrecision("avg_price").notNull().default(0),
    realizedPnl: doublePrecision("realized_pnl").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountSymbolUnique: uniqueIndex("positions_account_symbol_unique").on(
      t.accountId,
      t.symbol,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Watchlist (per-user set of followed symbols)
// ---------------------------------------------------------------------------

export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    /** Manual ordering within the user's watchlist (lower = higher). */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userSymbolUnique: uniqueIndex("watchlist_user_symbol_unique").on(
      t.userId,
      t.symbol,
    ),
    userIdx: index("watchlist_user_idx").on(t.userId, t.sortOrder),
  }),
);

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    kind: alertKind("kind").notNull(),
    threshold: doublePrecision("threshold").notNull(),
    timeframe: varchar("timeframe", { length: 5 }),
    status: alertStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    /** Value observed at trigger time (price or RSI). */
    triggeredValue: doublePrecision("triggered_value"),
  },
  (t) => ({
    userIdx: index("alerts_user_idx").on(t.userId),
    activeIdx: index("alerts_active_idx").on(t.symbol, t.status),
  }),
);

// ---------------------------------------------------------------------------
// Chart drawings (per-user, per-symbol/timeframe annotations)
// ---------------------------------------------------------------------------

export const drawingKind = pgEnum("drawing_kind", ["trendline", "horizontal"]);

export const drawings = pgTable(
  "drawings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    timeframe: varchar("timeframe", { length: 5 }).notNull(),
    kind: drawingKind("kind").notNull(),
    /** First anchor: time in epoch seconds (chart time), price on the y-axis. */
    x1: bigint("x1", { mode: "number" }).notNull(),
    y1: doublePrecision("y1").notNull(),
    /** Second anchor (trendline only; horizontal lines ignore x2). */
    x2: bigint("x2", { mode: "number" }),
    y2: doublePrecision("y2"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    lookupIdx: index("drawings_lookup_idx").on(t.userId, t.symbol, t.timeframe),
  }),
);

// ---------------------------------------------------------------------------
// Market data: OHLCV (partitioned by month in migration; one row per candle)
// ---------------------------------------------------------------------------

export const ohlcv = pgTable(
  "ohlcv",
  {
    symbol: varchar("symbol", { length: 20 }).notNull(),
    timeframe: varchar("timeframe", { length: 5 }).notNull(),
    /** Candle open time in epoch milliseconds. */
    openTime: bigint("open_time", { mode: "number" }).notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: doublePrecision("volume").notNull(),
    trades: integer("trades").notNull().default(0),
    closed: boolean("closed").notNull().default(true),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.symbol, t.timeframe, t.openTime] }),
    lookupIdx: index("ohlcv_lookup_idx").on(t.symbol, t.timeframe, t.openTime),
  }),
);

// ---------------------------------------------------------------------------
// Audit log (append-only)
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    /** Free-form JSON-as-text detail (kept small; no secrets). */
    detail: text("detail"),
    ip: varchar("ip", { length: 64 }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("audit_user_idx").on(t.userId, t.at),
    actionIdx: index("audit_action_idx").on(t.action),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types for application code
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type PositionRow = typeof positions.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type WatchlistRow = typeof watchlist.$inferSelect;
export type Drawing = typeof drawings.$inferSelect;
export type OhlcvRow = typeof ohlcv.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
