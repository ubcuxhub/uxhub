import type { ComponentProps } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Neutral numeric context: a share or additions, never a success/error state. */
export function MetricBadge({ trend, className, children, ...props }: ComponentProps<"span"> & { trend?: boolean }) {
  return <span data-slot="metric-badge" className={cn("inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1.5 text-badge text-muted-foreground", className)} {...props}>
    {trend && <TrendingUp aria-hidden="true" className="size-4 shrink-0" />}{children}
  </span>;
}
