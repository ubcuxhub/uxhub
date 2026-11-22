"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { ChartPeriodMenu } from "@/components/shared/ChartPeriodMenu";
import { DistributionChart } from "@/components/shared/DistributionChart";
import { ScrollableBarChart, type ChartPeriod } from "@/components/shared/ScrollableBarChart";
import { StatisticsCard } from "@/components/shared/StatisticsCard";
import { MetricBadge } from "@/components/ui/metric-badge";
import { Button } from "@/components/ui/button";
import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

const segments = [{ label: "Cognitive Systems", count: 12 }, { label: "Unknown", count: 8 }, { label: "A very long academic major that wraps across multiple lines", count: 5 }];
const periods: ChartPeriod[] = Array.from({ length: 12 }, (_, i) => ({ id: String(i), label: `${2017 + i}–${2018 + i}`, count: i < 2 || i === 11 ? null : i === 3 ? 0 : i * 7, coverage: i < 2 ? "unavailable" : i === 11 ? "future" : i === 2 ? "partial" : "complete" }));

export default function StatisticsCardDemo() {
  const [selected, setSelected] = useState<string>();
  const [period, setPeriod] = useState<"year" | "month">("year");
  const [year, setYear] = useState(2026);
  return <div className="flex flex-col gap-8">
    <SpecimenGroup title="Statistics surfaces and metrics" description="Card titles stay pinned; messages centre below. Neutral metric pills convey no success/error status. Use the theme/density controls to compare every example.">
      <Specimen label="Centered group: reserved text space keeps the donut stationary" className="w-[491px]">
        <StatisticsCard title="Distribution" size="compact" action={<Button size="sm" variant="secondary" onClick={() => setSelected(selected ? undefined : "Unknown")}>Select</Button>}>
          <div className="mx-auto flex w-full max-w-64 min-w-0 items-center gap-4 @min-[400px]/statistics:gap-8"><DistributionChart segments={segments} selected={selected} onSelect={setSelected} className="shrink-0" label="Demo distribution" /><div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]"><p className="text-h2">{segments.find((segment) => segment.label === selected)?.count ?? 25}</p><MetricBadge>{selected ? `${Math.round((segments.find((segment) => segment.label === selected)?.count ?? 0) / 25 * 100)}% · ${selected}` : "All accounts"}</MetricBadge></div></div>
        </StatisticsCard>
      </Specimen>
      <Specimen label="All Unknown is valid" className="w-[350px]"><StatisticsCard title="Distribution" size="compact"><DistributionChart segments={[{ label: "Unknown", count: 25 }]} label="Unknown distribution" selected="Unknown" /></StatisticsCard></Specimen>
      <Specimen label="Neutral numeric context"><MetricBadge trend>+11 past 30 days</MetricBadge><MetricBadge>Past 30 days: Data unavailable</MetricBadge></Specimen>
      <Specimen label="Empty" className="w-[350px]"><StatisticsCard title="Area of Study" size="compact" message={{ title: "No accounts yet", description: "Areas of study show up once accounts join." }} /></Specimen>
      <Specimen label="Error" className="w-[421px]"><StatisticsCard title="Club Members" message={{ title: "We couldn’t load club members", description: "Refresh the page to try again." }} /></Specimen>
      <Specimen label="Loading" className="w-[350px]"><StatisticsCard title="Area of Study" size="compact" loading /></Specimen>
      <Specimen label="Chart loading" className="w-[421px]"><StatisticsCard title="Club Members" loading /></Specimen>
    </SpecimenGroup>
    <SpecimenGroup title="Scrollable periods" description="Monthly starts at September and hides partial annotations; Yearly keeps coverage annotations and starts at the latest period. Hover, Tab/focus, or tap a bar for the same actual count and coverage. Arrows step one period; drag the native scrollbar. Up to seven bars fit, with fewer for long labels/narrow containers. Wheel scrolling and browser zoom stay native. No chart animation.">
      {[350, 616, 1000].map((width) => <Specimen key={width} label={`${width}px · unknown, partial, exact zero and future`} className="w-full" wide>
        <div className="min-w-0 max-w-full" style={{ width }}><StatisticsCard title="Reporting periods" titleAction={<IconButton label="Reporting periods use the selected academic year" variant="ghost" size="icon-sm"><Info /></IconButton>} action={<ChartPeriodMenu period={period} selectedYear={year} years={[{ value: 2026, label: "2026–2027" }, { value: 2025, label: "2025–2026" }]} onChange={(p, y) => { setPeriod(p); setYear(y); }} />}>
          <p className="text-h1">70 <MetricBadge trend>+11 past 30 days</MetricBadge></p>
          <p className="text-label text-muted-foreground">{year}–{year + 1}</p>
          <ScrollableBarChart key={`${period}:${year}`} initialScroll={period === "month" ? "start" : "end"} showPartialCoverage={period === "year"} label={`${width}px example`} periods={period === "year" ? periods : periods.slice(0, 8).map((p, i) => ({ ...p, label: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"][i] }))} wideLabels={period === "year"} />
        </StatisticsCard></div>
      </Specimen>)}
    </SpecimenGroup>
  </div>;
}
