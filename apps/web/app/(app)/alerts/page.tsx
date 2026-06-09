import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@obsidian/db";
import { alerts as alertsTable, type Alert } from "@obsidian/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { WATCHLIST } from "@/lib/env";
import { Panel, Badge, EmptyState } from "@/components/ui";
import { AlertForm } from "@/components/alert-form";
import { IconBell, IconX, IconCheck } from "@/components/icons";
import { prettySymbol, formatPrice, formatDateTime } from "@/lib/format";
import { deleteAlertAction, reactivateAlertAction } from "./actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  price_above: "Price above",
  price_below: "Price below",
  rsi_above: "RSI above",
  rsi_below: "RSI below",
};

function describe(a: Alert): string {
  const isRsi = a.kind.startsWith("rsi_");
  const target = isRsi ? a.threshold.toString() : formatPrice(a.threshold);
  const tf = a.timeframe ? ` · ${a.timeframe}` : "";
  return `${KIND_LABEL[a.kind]} ${target}${tf}`;
}

export default async function AlertsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.userId, user.id))
    .orderBy(desc(alertsTable.createdAt));

  const active = rows.filter((a) => a.status === "active");
  const triggered = rows.filter((a) => a.status === "triggered");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-fg-0">Alerts</h1>
        <p className="text-sm text-fg-1">
          The market gateway evaluates active alerts on every tick and notifies
          you in real time when a condition is met.
        </p>
      </div>

      <Panel title="New alert">
        <AlertForm symbols={WATCHLIST} />
      </Panel>

      <Panel title={`Active (${active.length})`} bodyClassName="overflow-hidden">
        {active.length === 0 ? (
          <EmptyState
            title="No active alerts"
            body="Create one above to be notified when the market moves."
            icon={<IconBell size={28} />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {active.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-fg-0">{prettySymbol(a.symbol)}</span>
                  <span className="text-sm text-fg-1">{describe(a)}</span>
                  <Badge tone="neutral">Watching</Badge>
                </div>
                <form action={deleteAlertAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    className="rounded p-1.5 text-fg-2 hover:bg-bg-3 hover:text-down"
                    aria-label="Delete alert"
                  >
                    <IconX size={16} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Triggered (${triggered.length})`} bodyClassName="overflow-hidden">
        {triggered.length === 0 ? (
          <p className="p-6 text-sm text-fg-1">No alerts have triggered yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {triggered.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-fg-0">{prettySymbol(a.symbol)}</span>
                  <span className="text-sm text-fg-1">{describe(a)}</span>
                  <Badge tone="up">
                    <IconCheck size={11} className="mr-1" />
                    Triggered
                  </Badge>
                  {a.triggeredAt && (
                    <span className="tabular text-2xs text-fg-2">
                      {formatDateTime(a.triggeredAt)}
                      {a.triggeredValue != null && ` · at ${formatPrice(a.triggeredValue)}`}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <form action={reactivateAlertAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn btn-ghost px-2 py-1 text-2xs">Re-arm</button>
                  </form>
                  <form action={deleteAlertAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      className="rounded p-1.5 text-fg-2 hover:bg-bg-3 hover:text-down"
                      aria-label="Delete alert"
                    >
                      <IconX size={16} />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
