"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

export interface DistributionSegment { label: string; count: number }

/** Full-population donut. Selecting changes emphasis, never the dataset. */
export function DistributionChart({ segments, selected, label, className, visualClassName, onSelect }: {
  segments: DistributionSegment[]; selected?: string; label: string; className?: string; visualClassName?: string; onSelect?: (label: string) => void;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  return <div className={className}>
    <div aria-hidden="true" className={visualClassName}>
      <ChartContainer config={{ count: { label } }} className="size-[85px] aspect-square" responsive={false}>
        <PieChart width={85} height={85} accessibilityLayer={false}>
          <Pie onClick={(_, index) => onSelect?.(segments[index].label)} data={segments} dataKey="count" nameKey="label" innerRadius={25} outerRadius={42} stroke="var(--card)" strokeWidth={1} isAnimationActive={false}>
            {segments.map((segment) => <Cell key={segment.label} fill={segment.label === selected ? "var(--primary)" : "var(--border)"} className={onSelect ? "cursor-pointer hover:fill-primary" : "hover:fill-primary"} />)}
          </Pie>
        </PieChart>
      </ChartContainer>
    </div>
    <ul aria-label={label} className="sr-only">
      {segments.map((segment) => <li key={segment.label}>{segment.label}: {segment.count.toLocaleString("en-CA")} ({total ? Math.round(segment.count / total * 100) : 0}%){segment.label === selected ? ", selected" : ""}</li>)}
    </ul>
  </div>;
}
