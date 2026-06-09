import { redirect } from "next/navigation";
import { getCurrentUser, ensureAccount } from "@/lib/auth";
import { getAccount, getPositions, getTrades } from "@/lib/trading";
import { WATCHLIST } from "@/lib/env";
import { TradeDesk } from "@/components/trade-desk";

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await ensureAccount(user.id);
  const account = await getAccount(user.id);
  if (!account) redirect("/login");

  const [positions, trades] = await Promise.all([
    getPositions(account.id),
    getTrades(account.id, 100),
  ]);

  return (
    <TradeDesk
      account={account}
      positions={positions}
      trades={trades}
      symbols={WATCHLIST}
    />
  );
}
