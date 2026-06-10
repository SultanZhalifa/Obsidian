"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout. It must render its
 * own <html>/<body> since the normal layout failed. Inline styles are used
 * because the global stylesheet may not have loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0b0d",
          color: "#e6e8eb",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600 }}>OBSIDIAN hit an error</h1>
          <p style={{ fontSize: 14, color: "#9aa0a8" }}>
            The application failed to load. Please reload the page.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 12,
              border: "1px solid #23262d",
              background: "#e6e8eb",
              color: "#0a0b0d",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
