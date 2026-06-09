"use client";

import { useEffect, useRef } from "react";
import type { ServerMessage } from "@obsidian/core";
import { getGatewayClient } from "@/lib/ws-client";
import { useToast } from "./toast";
import { prettySymbol, formatPrice } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  price_above: "rose above",
  price_below: "fell below",
  rsi_above: "RSI rose above",
  rsi_below: "RSI fell below",
};

/**
 * Listens for triggered-alert broadcasts and surfaces the current user's own
 * alerts as toasts. Mounted once in the app shell. The trigger is also
 * persisted server-side, so a user offline at trigger time still sees it in
 * their alert log on next load.
 */
export function AlertListener({ userId }: { userId: string }) {
  const { push } = useToast();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const client = getGatewayClient();
    return client.addListener((msg: ServerMessage) => {
      if (msg.type !== "alert") return;
      if (msg.userId !== userId) return;
      if (seen.current.has(msg.alertId)) return;
      seen.current.add(msg.alertId);

      const verb = KIND_LABEL[msg.kind] ?? "triggered";
      const isRsi = msg.kind.startsWith("rsi_");
      push({
        kind: "info",
        title: `Alert · ${prettySymbol(msg.symbol)}`,
        body: isRsi
          ? `${verb} ${msg.threshold} (now ${msg.value.toFixed(1)})`
          : `Price ${verb} ${formatPrice(msg.threshold)} (now ${formatPrice(msg.value)})`,
      });
    });
  }, [userId, push]);

  return null;
}
