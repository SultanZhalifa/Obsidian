import { and, eq } from "drizzle-orm";
import { db } from "@obsidian/db";
import { alerts, type Alert } from "@obsidian/db/schema";
import type { Timeframe } from "@obsidian/core";
import { logger, errInfo } from "./logger.js";

export interface TriggeredAlert {
  alert: Alert;
  value: number;
}

/**
 * Evaluates active alerts against live market values and persists triggers.
 *
 * To keep evaluation O(1) per tick, active alerts are cached in memory and
 * refreshed periodically (and immediately when a new alert is created via
 * `add()`). Price alerts are evaluated on every trade tick; RSI alerts are
 * evaluated whenever a fresh RSI value is available for the matching timeframe.
 */
export class AlertsRunner {
  /** symbol(lower) -> active alerts for that symbol. */
  private bySymbol = new Map<string, Alert[]>();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(private readonly onTrigger: (t: TriggeredAlert) => void) {}

  async start(): Promise<void> {
    await this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, 15_000);
  }

  stop(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  /** Reload the active-alert cache from the database. */
  async refresh(): Promise<void> {
    try {
      const active = await db
        .select()
        .from(alerts)
        .where(eq(alerts.status, "active"));
      const map = new Map<string, Alert[]>();
      for (const a of active) {
        const key = a.symbol.toLowerCase();
        const list = map.get(key) ?? [];
        list.push(a);
        map.set(key, list);
      }
      this.bySymbol = map;
    } catch (err) {
      logger.error({ err: errInfo(err) }, "failed to refresh alerts");
    }
  }

  /** Evaluate price-based alerts for a symbol against the latest trade price. */
  evaluatePrice(symbol: string, price: number): void {
    const list = this.bySymbol.get(symbol.toLowerCase());
    if (!list) return;
    for (const a of list) {
      if (a.status !== "active") continue;
      if (a.kind === "price_above" && price >= a.threshold) this.trigger(a, price);
      else if (a.kind === "price_below" && price <= a.threshold) this.trigger(a, price);
    }
  }

  /** Evaluate RSI-based alerts for a symbol/timeframe against the latest RSI. */
  evaluateRsi(symbol: string, timeframe: Timeframe, rsiValue: number): void {
    const list = this.bySymbol.get(symbol.toLowerCase());
    if (!list) return;
    for (const a of list) {
      if (a.status !== "active") continue;
      if (a.timeframe !== timeframe) continue;
      if (a.kind === "rsi_above" && rsiValue >= a.threshold) this.trigger(a, rsiValue);
      else if (a.kind === "rsi_below" && rsiValue <= a.threshold) this.trigger(a, rsiValue);
    }
  }

  private trigger(alert: Alert, value: number): void {
    // Mark inactive in-memory immediately to avoid duplicate firings before
    // the DB write completes.
    alert.status = "triggered";
    void this.persistTrigger(alert, value);
    this.onTrigger({ alert, value });
  }

  private async persistTrigger(alert: Alert, value: number): Promise<void> {
    try {
      await db
        .update(alerts)
        .set({
          status: "triggered",
          triggeredAt: new Date(),
          triggeredValue: value,
        })
        .where(and(eq(alerts.id, alert.id), eq(alerts.status, "active")));
      logger.info({ alertId: alert.id, value }, "alert triggered");
    } catch (err) {
      logger.error(
        { err: errInfo(err), alertId: alert.id },
        "failed to persist alert trigger",
      );
    }
  }
}
