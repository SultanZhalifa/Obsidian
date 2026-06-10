import { redirect } from "next/navigation";
import { getCurrentUser, ensureAccount } from "@/lib/auth";
import {
  getAccount,
  getPositions,
  getTrades,
  getRealizedEquityCurve,
} from "@/lib/trading";
import { ensureWatchlist } from "@/lib/watchlist";
import { TradeDesk } from "@/components/trade-desk";

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await ensureAccount(user.id);
  const account = await getAccount(user.id);
  if (!account) redirect("/login");

  const [positions, trades, equityCurve, symbols] = await Promise.all([
    getPositions(account.id),
    getTrades(account.id, 100),
    getRealizedEquityCurve(account.id, account.startingCash),
    ensureWatchlist(user.id),
  ]);

  return (
    <TradeDesk
      account={account}
      positions={positions}
      trades={trades}
      equityCurve={equityCurve}
      symbols={symbols}
    />
  );
}
