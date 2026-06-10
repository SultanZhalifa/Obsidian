import { redirect } from "next/navigation";
import { TIMEFRAMES, type Timeframe } from "@obsidian/core";
import { getKlines, getTradableSymbols } from "@/lib/market";
import { getCurrentUser } from "@/lib/auth";
import { ensureWatchlist } from "@/lib/watchlist";
import { getDrawings } from "@/lib/drawings";
import { ChartWorkspace } from "@/components/chart-workspace";
import type { DrawingShape } from "@/components/price-chart";
import { OrderBook } from "@/components/orderbook";
import { TradeTape } from "@/components/trade-tape";

export const dynamic = "force-dynamic";

function parseTimeframe(v: string | undefined): Timeframe {
  return (TIMEFRAMES as readonly string[]).includes(v ?? "")
    ? (v as Timeframe)
    : "15m";
}

export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; tf?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const watchlist = await ensureWatchlist(user.id);
  const requested = (params.symbol ?? watchlist[0] ?? "BTCUSDT").toUpperCase();

  // Allow charting any tradable symbol (e.g. a deep link), not just watchlist
  // entries. Fall back to the first watchlist symbol if the request is invalid.
  const tradable = await getTradableSymbols();
  const tradableSet = new Set(tradable.map((s) => s.symbol));
  const symbol = tradableSet.has(requested)
    ? requested
    : (watchlist[0] ?? "BTCUSDT");
  const timeframe = parseTimeframe(params.tf);

  // The chart's market selector offers the user's watchlist, plus the current
  // symbol if it isn't already in it.
  const selectorSymbols = watchlist.includes(symbol)
    ? watchlist
    : [symbol, ...watchlist];

  const [candles, drawingRows] = await Promise.all([
    getKlines(symbol, timeframe, 500),
    getDrawings(user.id, symbol, timeframe),
  ]);

  const initialDrawings: DrawingShape[] = drawingRows.map((d) => ({
    id: d.id,
    kind: d.kind,
    x1: d.x1,
    y1: d.y1,
    x2: d.x2,
    y2: d.y2,
  }));

  return (
    <div className="flex h-full flex-col xl:flex-row">
      <div className="min-h-[60vh] flex-1 xl:min-h-0">
        <ChartWorkspace
          symbol={symbol}
          timeframe={timeframe}
          candles={candles}
          watchlist={selectorSymbols}
          initialDrawings={initialDrawings}
        />
      </div>
      <aside className="flex shrink-0 flex-col border-t border-line xl:w-80 xl:border-l xl:border-t-0">
        <div className="flex min-h-[280px] flex-1 flex-col border-b border-line">
          <div className="panel-header">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-1">
              Order book
            </h2>
          </div>
          <div className="min-h-0 flex-1">
            <OrderBook symbol={symbol} timeframe={timeframe} />
          </div>
        </div>
        <div className="flex min-h-[260px] flex-1 flex-col">
          <div className="panel-header">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-1">
              Trades
            </h2>
          </div>
          <div className="min-h-0 flex-1">
            <TradeTape symbol={symbol} timeframe={timeframe} />
          </div>
        </div>
      </aside>
    </div>
  );
}
