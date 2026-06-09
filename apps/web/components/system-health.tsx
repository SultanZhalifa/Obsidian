"use client";

import { useQuery } from "@tanstack/react-query";
import { Stat } from "./ui";
import { IconDot } from "./icons";

interface HealthResponse {
  db: boolean;
  gateway:
    | {
        status: string;
        uptimeSeconds?: number;
        binanceConnected?: boolean;
        clients?: number;
        symbols?: string[];
        timeframes?: string[];
      }
    | { status: string };
}

function fmtUptime(s?: number): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function SystemHealth() {
  const { data, isError } = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health", { cache: "no-store" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const gw = data?.gateway as HealthResponse["gateway"] & {
    uptimeSeconds?: number;
    binanceConnected?: boolean;
    clients?: number;
    symbols?: string[];
  };
  const dbOk = data?.db ?? false;
  const binanceOk = gw?.binanceConnected ?? false;
  const gatewayOk = gw?.status === "ok";

  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
      <HealthLight label="Database" ok={dbOk && !isError} />
      <HealthLight label="Gateway" ok={gatewayOk} />
      <HealthLight label="Binance feed" ok={binanceOk} />
      <Stat label="Gateway uptime" value={fmtUptime(gw?.uptimeSeconds)} />
      <Stat label="Connected clients" value={String(gw?.clients ?? 0)} />
      <Stat
        label="Streamed markets"
        value={String(gw?.symbols?.length ?? 0)}
        hint={gw?.symbols?.join(", ")}
      />
    </div>
  );
}

function HealthLight({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-wide text-fg-2">{label}</span>
      <span className="flex items-center gap-1.5 text-sm text-fg-0">
        <IconDot size={12} className={ok ? "text-up" : "text-down animate-pulse"} />
        {ok ? "Operational" : "Down"}
      </span>
    </div>
  );
}
