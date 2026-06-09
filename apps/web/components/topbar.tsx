"use client";

import { useState } from "react";
import { IconLogo, IconDot, IconLogout } from "./icons";
import { useGatewayStatus } from "@/lib/use-market";
import type { AuthedUser } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";

export function TopBar({ user }: { user: AuthedUser }) {
  const connected = useGatewayStatus();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-bg-1 px-3">
      <div className="flex items-center gap-2.5">
        <IconLogo size={22} className="text-fg-0" />
        <span className="text-sm font-semibold tracking-[0.2em] text-fg-0">
          OBSIDIAN
        </span>
        <span className="hidden text-2xs uppercase tracking-wider text-fg-2 sm:inline">
          Trading Terminal
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-1.5 text-2xs uppercase tracking-wider"
          title={connected ? "Live market feed connected" : "Reconnecting to market feed"}
        >
          <IconDot
            size={12}
            className={connected ? "text-up" : "text-down animate-pulse"}
          />
          <span className="hidden text-fg-1 sm:inline">
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded px-2 py-1 text-sm text-fg-1 hover:bg-bg-2 hover:text-fg-0"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Account menu for ${user.displayName ?? user.email}`}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full border border-line bg-bg-3 text-2xs font-semibold text-fg-0">
              {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[160px] truncate md:inline">
              {user.displayName ?? user.email}
            </span>
            {user.role === "admin" && (
              <span className="hidden rounded border border-line px-1 text-2xs uppercase text-fg-2 md:inline">
                Admin
              </span>
            )}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-1 w-56 rounded-md border border-line bg-bg-2 p-1 shadow-panel"
            >
              <div className="border-b border-line px-3 py-2">
                <p className="truncate text-sm text-fg-0">
                  {user.displayName ?? "Trader"}
                </p>
                <p className="truncate text-2xs text-fg-2">{user.email}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-fg-1 hover:bg-bg-3 hover:text-fg-0"
                >
                  <IconLogout size={16} />
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
