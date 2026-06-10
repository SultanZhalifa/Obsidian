"use client";

import { useEffect, useState } from "react";
import { useGatewayStatus } from "@/lib/use-market";
import { IconWarning } from "./icons";

/**
 * A thin banner shown when the live market feed drops. Debounced by ~1.2s so a
 * fast reconnect doesn't flash the banner. The gateway/client auto-reconnect;
 * this just makes a sustained outage visible.
 */
export function ConnectionBanner() {
  const connected = useGatewayStatus();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (connected) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, [connected]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warn/30 bg-warn/10 px-4 py-1.5 text-2xs text-warn"
    >
      <IconWarning size={13} />
      <span>
        Reconnecting to the live market feed… data may be momentarily stale.
      </span>
    </div>
  );
}
