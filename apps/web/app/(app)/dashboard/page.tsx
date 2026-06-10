import { redirect } from "next/navigation";
import { getTicker24h, type Ticker24h } from "@/lib/market";
import { getCurrentUser } from "@/lib/auth";
import { ensureWatchlist } from "@/lib/watchlist";
import { Panel } from "@/components/ui";
import { Watchlist } from "@/components/watchlist";
import { IconWarning } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const symbols = await ensureWatchlist(user.id);

  let tickers: Ticker24h[];
  let error: string | null = null;
  try {
    tickers = await getTicker24h(symbols);
  } catch {
    error = "Unable to reach the market data source. The live feed will recover automatically.";
    tickers = [];
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg-0">Markets</h1>
        <p className="text-sm text-fg-1">
          Live prices from Binance public market data. Add markets to your
          watchlist and click any row to open the chart.
        </p>
      </div>

      <Panel title="Watchlist" bodyClassName="overflow-hidden">
        {error ? (
          <div className="flex items-center gap-2 p-6 text-sm text-fg-1">
            <IconWarning size={18} className="text-warn" />
            {error}
          </div>
        ) : (
          <Watchlist symbols={symbols} initial={tickers} />
        )}
      </Panel>
    </div>
  );
}
