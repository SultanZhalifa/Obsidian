import { TIMEFRAMES, type Timeframe } from "@obsidian/core";
import { getKlines } from "@/lib/market";
import { WATCHLIST } from "@/lib/env";
import { ChartWorkspace } from "@/components/chart-workspace";
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
  const params = await searchParams;
  const symbolRaw = (params.symbol ?? WATCHLIST[0] ?? "BTCUSDT").toUpperCase();
  const symbol = WATCHLIST.includes(symbolRaw) ? symbolRaw : (WATCHLIST[0] ?? "BTCUSDT");
  const timeframe = parseTimeframe(params.tf);

  const candles = await getKlines(symbol, timeframe, 500);

  return (
    <div className="flex h-full flex-col xl:flex-row">
      <div className="min-h-[60vh] flex-1 xl:min-h-0">
        <ChartWorkspace
          symbol={symbol}
          timeframe={timeframe}
          candles={candles}
          watchlist={WATCHLIST}
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
