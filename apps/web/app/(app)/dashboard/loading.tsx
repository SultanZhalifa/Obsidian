import { Panel, Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Panel title="Watchlist" bodyClassName="overflow-hidden">
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center gap-8">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="hidden h-4 w-16 sm:block" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
