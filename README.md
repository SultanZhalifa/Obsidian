<div align="center">

# OBSIDIAN

**Enterprise-grade, real-time crypto trading terminal.**

Live market data · technical indicators computed from scratch · paper-trading P&L engine · real-time alerts · full auth/RBAC/audit stack.

No mock data anywhere — every price, candle, indicator and position is real.

</div>

---

## What it is

OBSIDIAN is a professional trading terminal built as a single, cohesive full-stack
TypeScript system. It connects to Binance's public market-data feed, computes
technical indicators server-side, lets you paper-trade against live prices with a
real average-cost P&L engine, and fires alerts the instant market conditions are
met — all behind a session-based auth system with role-based access control and an
append-only audit log.

The interface is a deliberate **monochrome design system**: a graded grayscale
ramp (not just black & white) with thin, low-chroma semantic accents for gain /
loss / status, tuned for long sessions and WCAG AA contrast. Every glyph is a
hand-built stroke SVG — there are no emoji or icon fonts.

## Feature highlights

| Area | What's real |
| --- | --- |
| **Markets** | Live watchlist of 5 pairs — real 24h ticker, % change, high/low, volume, updating per tick over WebSocket. |
| **Chart** | Real OHLCV candles (REST backfill + live deltas), 6 timeframes, EMA / Bollinger / VWAP overlays, RSI / MACD / Stochastic / ATR sub-panes, and persistent drawing tools (trendlines + horizontal levels saved per user/symbol). Powered by TradingView's `lightweight-charts`. |
| **Order book & tape** | Live bid/ask depth ladder with cumulative-depth bars and a streaming trade tape. |
| **Paper trading** | Virtual $100k account. Market orders fill at the live price; positions, realized & unrealized P&L are computed by a tested average-cost engine and marked to real-time prices. Long, short, partial-close and flip all handled. |
| **Alerts** | Price and RSI alerts evaluated by the gateway on every tick, persisted, and pushed to the browser as toasts in real time. |
| **Admin** | RBAC-gated dashboard: user list, live system/feed health, and the security audit trail. |
| **PWA & polish** | Installable PWA (manifest + service worker, offline shell — never caches live data), keyboard shortcuts (`g d/c/t/a` to navigate, `/` search, `?` help), loading skeletons, per-route error boundaries, and a reconnect banner when the feed drops. |

## Architecture

```
obsidian/
├─ apps/web                 Next.js 15 (App Router, RSC, Server Actions)
├─ services/market-gateway  Node WS service: Binance feed -> indicators / alerts
│                           / persistence -> our own WebSocket fan-out
├─ packages/core            Pure indicators, P&L engine, Zod schemas, shared types
├─ packages/db              Drizzle ORM schema + migrations (Postgres / TimescaleDB)
└─ docker-compose.yml       postgres (TimescaleDB) + gateway + web
```

A **single durable upstream connection** to Binance lives in the gateway — not one
per browser. The gateway computes authoritative indicators, evaluates alerts,
persists closed candles to a TimescaleDB hypertable, and fans messages out to all
connected clients over its own typed WebSocket protocol. The browser subscribes
through one shared, auto-reconnecting client.

### Stack

Next.js 15 · TypeScript (strict) · PostgreSQL + TimescaleDB · Drizzle ORM ·
TanStack Query · Zustand · lightweight-charts · Tailwind (custom monochrome
tokens) · Argon2id + session auth · Zod · pino · `ws` · Vitest · Playwright ·
Docker Compose · GitHub Actions.

## Quick start

Prerequisites: Node 20+, Docker.

```bash
cp .env.example .env
npm install

# 1. Start Postgres (TimescaleDB) and apply the schema
docker compose up -d postgres
npm run db:migrate
npm run timescale --workspace packages/db   # promote ohlcv to a hypertable

# 2. Start the market gateway (real Binance feed + WS fan-out)
npm run dev:gateway

# 3. In another terminal, start the web app
npm run dev:web
```

Open <http://localhost:3000>. The **first account you register becomes the admin**.

> **Data source.** Defaults use Binance's official public market-data mirror
> (`data-api.binance.vision` / `data-stream.binance.vision`), which is reachable
> worldwide and serves real data with no API key. Point `BINANCE_REST_BASE` /
> `BINANCE_WS_BASE` at `api.binance.com` if that host is reachable from your region.

### Run everything in Docker

```bash
cp .env.example .env
docker compose up -d        # postgres + gateway + web
npm run db:migrate          # one-time, against the running postgres
```

## Tests

```bash
npm run test --workspace packages/core   # indicator + P&L unit tests (Vitest)
npm run e2e  --workspace apps/web         # full browser flow (Playwright)
```

- **Unit** — indicators validated against canonical reference series (e.g. Wilder's
  RSI worked example); the P&L engine validated across open / add / partial-close /
  flat / flip / fee scenarios for both longs and shorts.
- **E2E** — register → live dashboard → chart → place a paper order → see the
  position → create an alert → sign out, on both desktop and mobile viewports.

## Security & operations

- **Auth** — session tokens are random, stored only as SHA-256 hashes; passwords
  hashed with Argon2id (OWASP parameters). Sliding-expiry sessions in httpOnly,
  SameSite cookies. Login timing is equalized to resist user enumeration.
- **RBAC** — `admin` / `trader` roles; admin routes guarded server-side.
- **CSRF** — origin verification on every state-changing Server Action.
- **Rate limiting** — token-bucket limits on auth, order and alert endpoints.
- **Audit log** — append-only record of register / login / order / alert events.
- **Observability** — pino structured logs, `/api/health` (DB + gateway + Binance
  liveness), gateway auto-reconnect with exponential backoff surfaced in the UI.

## License

MIT — for educational and portfolio use. Paper trading only; no real funds, no
exchange API keys, no financial advice.
