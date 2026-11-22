import { useId, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Shared chart surface; title stays pinned in loading, empty and error states. */
export function StatisticsCard({ title, titleAction, size = "chart", action, message, loading, children, className }: {
  title: string; titleAction?: ReactNode; size?: "compact" | "chart"; action?: ReactNode;
  message?: { title: string; description: string }; loading?: boolean;
  children?: ReactNode; className?: string;
}) {
  const id = useId();
  const heading = <h3 id={id} className="text-body-medium">{title}</h3>;
  return <Card role="region" aria-labelledby={id} aria-busy={loading || undefined}
    className={cn("@container/statistics min-w-0 gap-2 px-6 py-5", size === "compact" ? "min-h-[120px] sm:min-h-[124px]" : "min-h-[290px]", size === "chart" && !message && !loading && "gap-0 pt-4 pb-3", size === "compact" && !message && !loading && "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4", className)}>
    <div className={cn("flex min-w-0 items-center justify-between gap-2", size === "compact" && !message && !loading && "flex-col items-start gap-2.5")}>
      {titleAction ? <div className="flex min-w-0 items-center gap-1">{heading}{titleAction}</div> : heading}
      {!message && !loading && action}
    </div>
    {loading ? <div role="status" aria-label={`Loading ${title}`} className="flex flex-1 items-center gap-4">
      <Skeleton className={size === "compact" ? "size-16 shrink-0 rounded-full" : "h-36 w-full"} />
      {size === "compact" && <Skeleton className="h-10 w-24" />}
    </div> : message ? <EmptyState size="inline" titleAs="p" title={message.title} description={message.description}
      className="flex-1 justify-center px-0 py-0 [&_[data-slot=empty-state-title]]:text-small [&_[data-slot=empty-state-title]]:font-semibold [&_[data-slot=empty-state-description]]:mt-1" /> : children}
  </Card>;
}
