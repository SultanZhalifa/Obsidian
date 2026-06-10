"use client";

import { useEffect } from "react";
import { IconWarning } from "./icons";

/**
 * Shared error-boundary UI for route `error.tsx` files. Logs the error to the
 * console (a real app would forward this to an error tracker) and offers a
 * retry that re-renders the segment.
 */
export function RouteError({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <IconWarning size={28} className="text-warn" />
        <p className="text-sm font-medium text-fg-0">{title}</p>
        <p className="text-sm text-fg-1">
          This section hit an unexpected error. The rest of the terminal is
          unaffected — you can retry below.
        </p>
        {error.digest && (
          <code className="rounded bg-bg-2 px-2 py-1 text-2xs text-fg-2">
            ref: {error.digest}
          </code>
        )}
        <button onClick={reset} className="btn btn-primary mt-1">
          Retry
        </button>
      </div>
    </div>
  );
}
