"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "./icons";

interface Shortcut {
  keys: string;
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: "g then d", label: "Go to Markets" },
  { keys: "g then c", label: "Go to Chart" },
  { keys: "g then t", label: "Go to Trade" },
  { keys: "g then a", label: "Go to Alerts" },
  { keys: "/", label: "Search markets (on Markets)" },
  { keys: "?", label: "Show this help" },
  { keys: "Esc", label: "Close dialogs" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Global keyboard shortcuts for fast navigation, in the spirit of a pro
 * terminal. A `g`-prefixed leader allows two-key "go to" chords. Shortcuts are
 * ignored while typing in a field. `/` and `?` open search / help.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [leader, setLeader] = useState(false);

  useEffect(() => {
    let leaderTimer: ReturnType<typeof setTimeout> | null = null;

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "Escape") {
        setHelpOpen(false);
        setLeader(false);
        return;
      }

      // Two-key "go to" chords: press g, then a destination.
      if (leader) {
        const routes: Record<string, string> = {
          d: "/dashboard",
          c: "/chart",
          t: "/trade",
          a: "/alerts",
        };
        const dest = routes[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        setLeader(false);
        if (leaderTimer) clearTimeout(leaderTimer);
        return;
      }

      if (e.key === "g") {
        setLeader(true);
        leaderTimer = setTimeout(() => setLeader(false), 1200);
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      if (e.key === "/") {
        // Let the active page open its search (Markets listens for this).
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("obsidian:open-search"));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (leaderTimer) clearTimeout(leaderTimer);
    };
  }, [leader, router]);

  if (!helpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={() => setHelpOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-lg border border-line bg-bg-1 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-fg-0">Keyboard shortcuts</h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="rounded p-1 text-fg-2 hover:bg-bg-3 hover:text-fg-0"
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>
        <ul className="divide-y divide-line">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-fg-1">{s.label}</span>
              <kbd className="tabular rounded border border-line bg-bg-2 px-1.5 py-0.5 text-2xs text-fg-0">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
