import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { AlertListener } from "@/components/alert-listener";
import { ConnectionBanner } from "@/components/connection-banner";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg-0">
      <TopBar user={user} />
      <ConnectionBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar role={user.role} />
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
      <AlertListener userId={user.id} />
      <KeyboardShortcuts />
    </div>
  );
}
