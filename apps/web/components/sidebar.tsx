"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  IconChart,
  IconCandles,
  IconWallet,
  IconBell,
  IconShield,
} from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: typeof IconChart;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Markets", icon: IconChart },
  { href: "/chart", label: "Chart", icon: IconCandles },
  { href: "/trade", label: "Trade", icon: IconWallet },
  { href: "/alerts", label: "Alerts", icon: IconBell },
  { href: "/admin", label: "Admin", icon: IconShield, adminOnly: true },
];

export function Sidebar({ role }: { role: "admin" | "trader" }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 flex-col gap-1 border-r border-line bg-bg-1 p-2 md:w-52"
    >
      {NAV.filter((n) => !n.adminOnly || role === "admin").map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-bg-3 text-fg-0"
                : "text-fg-1 hover:bg-bg-2 hover:text-fg-0",
            )}
          >
            <Icon size={18} className="shrink-0" />
            <span className="hidden md:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
