import { IconLogo, IconWarning } from "@/components/icons";

export const metadata = { title: "Offline — OBSIDIAN" };

export default function OfflinePage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg-0 px-4 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <IconLogo size={40} className="text-fg-1" />
        <div className="flex items-center gap-2 text-warn">
          <IconWarning size={18} />
          <span className="text-sm font-medium">You&apos;re offline</span>
        </div>
        <p className="text-sm text-fg-1">
          OBSIDIAN needs a live connection for real-time market data. Reconnect to
          the internet and the terminal will resume automatically.
        </p>
        <a href="/dashboard" className="btn btn-primary">
          Retry
        </a>
      </div>
    </div>
  );
}
