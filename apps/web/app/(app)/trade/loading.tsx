import { Panel, Skeleton } from "@/components/ui";

export default function TradeLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Panel title="Account">
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Equity curve" bodyClassName="p-2">
        <Skeleton className="h-56 w-full" />
      </Panel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title="Open positions">
          <div className="p-4">
            <Skeleton className="h-24 w-full" />
          </div>
        </Panel>
        <Panel title="Order ticket">
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
