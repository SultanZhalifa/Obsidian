import { getTicker24h, type Ticker24h } from "@/lib/market";
import { WATCHLIST } from "@/lib/env";
import { Panel } from "@/components/ui";
import { Watchlist } from "@/components/watchlist";
import { IconWarning } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let tickers: Ticker24h[];
  let error: string | null = null;
  try {
    tickers = await getTicker24h(WATCHLIST);
  } catch {
    error = "Unable to reach the market data source. The live feed will recover automatically.";
    tickers = [];
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg-0">Markets</h1>
        <p className="text-sm text-fg-1">
          Live prices from Binance public market data. Click a market to open the chart.
        </p>
      </div>

      <Panel title="Watchlist" bodyClassName="overflow-hidden">
        {error ? (
          <div className="flex items-center gap-2 p-6 text-sm text-fg-1">
            <IconWarning size={18} className="text-warn" />
            {error}
          </div>
        ) : (
          <Watchlist initial={tickers} />
        )}
      </Panel>
    </div>
  );
}
