import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useId } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardProps = { label: string; className?: string } & (
  | {
      kind: "value";
      value: number;
      change?: { delta: number; period: string };
    }
  | { kind: "rate"; count: number; total: number; noun: string }
  | { kind: "insufficient"; reason: string }
  | { kind: "loading" }
);

const numberFormatter = new Intl.NumberFormat("en-CA");

function Change({ delta, period }: { delta: number; period: string }) {
  const direction = delta > 0 ? "Up" : delta < 0 ? "Down" : "No change";
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const amount = numberFormatter.format(Math.abs(delta));
  const screenReaderText =
    delta === 0 ? `${direction} ${period}` : `${direction} ${amount} ${period}`;

  return (
    <p
      data-slot="stat-card-change"
      className="flex min-w-0 items-center gap-1 text-label text-foreground"
    >
      <span aria-hidden className="inline-flex min-w-0 items-center gap-1">
        <Icon className="size-3.5 shrink-0" />
        <span className="font-semibold tabular-nums">{amount}</span>
        <span className="truncate font-normal text-muted-foreground">
          {period}
        </span>
      </span>
      <span className="sr-only">{screenReaderText}</span>
    </p>
  );
}

function StatCard({ label, className, ...stat }: StatCardProps) {
  const labelId = useId();
  const rateHasData = stat.kind !== "rate" || stat.total > 0;
  const insufficient = stat.kind === "insufficient" || !rateHasData;

  return (
    <div
      data-slot="stat-card"
      role="group"
      aria-labelledby={labelId}
      aria-busy={stat.kind === "loading" || undefined}
      className={cn(
        "flex min-h-[132px] min-w-0 flex-col items-start gap-2 rounded-xl border border-border bg-card p-5 text-card-foreground",
        insufficient && "text-muted-foreground",
        className,
      )}
    >
      <p
        id={labelId}
        className="w-full text-small font-medium text-muted-foreground"
      >
        {label}
      </p>

      {stat.kind === "loading" ? (
        <>
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-3 w-42 max-w-full rounded-full" />
        </>
      ) : insufficient ? (
        <>
          <p className="text-subheading text-muted-foreground">
            Not enough data
          </p>
          <p className="text-label font-normal text-muted-foreground">
            {stat.kind === "insufficient"
              ? stat.reason
              : `No ${stat.noun} to calculate a rate.`}
          </p>
        </>
      ) : stat.kind === "rate" ? (
        <>
          <p className="flex items-baseline text-h1 text-foreground tabular-nums">
            {Math.round((stat.count / stat.total) * 100)}
            <span className="ml-0.5 text-body-medium text-muted-foreground">
              %
            </span>
          </p>
          <p className="text-label font-normal text-muted-foreground">
            {numberFormatter.format(stat.count)} of{" "}
            {numberFormatter.format(stat.total)} {stat.noun}
          </p>
        </>
      ) : (
        <>
          <p className="text-h1 text-foreground tabular-nums">
            {numberFormatter.format(stat.value)}
          </p>
          {stat.change ? <Change {...stat.change} /> : null}
        </>
      )}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
