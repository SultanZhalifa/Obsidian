import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ensureWatchlist } from "@/lib/watchlist";
import { BacktestWorkbench } from "@/components/backtest-workbench";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const symbols = await ensureWatchlist(user.id);

  return <BacktestWorkbench symbols={symbols} />;
}
