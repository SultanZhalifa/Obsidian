import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { IconLogo } from "@/components/icons";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh place-items-center bg-bg-0 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <IconLogo size={36} className="text-fg-0" />
          <div>
            <h1 className="text-lg font-semibold tracking-[0.25em] text-fg-0">
              OBSIDIAN
            </h1>
            <p className="mt-1 text-2xs uppercase tracking-wider text-fg-2">
              Real-time trading terminal
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
