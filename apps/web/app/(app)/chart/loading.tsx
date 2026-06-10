import { Skeleton } from "@/components/ui";

export default function ChartLoading() {
  return (
    <div className="flex h-full flex-col xl:flex-row">
      <div className="flex min-h-[60vh] flex-1 flex-col xl:min-h-0">
        <div className="flex items-center justify-between border-b border-line bg-bg-1 px-4 py-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
      <aside className="hidden shrink-0 flex-col border-l border-line p-4 xl:flex xl:w-80">
        <Skeleton className="mb-2 h-5 w-24" />
        <Skeleton className="h-1/2 w-full" />
        <Skeleton className="mb-2 mt-4 h-5 w-20" />
        <Skeleton className="h-1/3 w-full" />
      </aside>
    </div>
  );
}
