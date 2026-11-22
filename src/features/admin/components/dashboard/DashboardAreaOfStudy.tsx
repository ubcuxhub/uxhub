"use client";

import { useState } from "react";
import { ChevronDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MetricBadge } from "@/components/ui/metric-badge";
import { DistributionChart } from "@/components/shared/DistributionChart";
import { StatisticsCard } from "@/components/shared/StatisticsCard";
import type { MajorDistribution } from "@/lib/supabase-helpers/admin-dashboard";

export function DashboardAreaOfStudy({ data }: { data: MajorDistribution | null }) {
  const [major, setMajor] = useState<string>();
  const selected = data?.majors.find((segment) => segment.major === major);
  return <StatisticsCard title="Area of Study" size="compact"
    message={!data ? { title: "We couldn’t load areas of study", description: "Refresh the page to try again." } : data.totalAccounts === 0 ? { title: "No accounts yet", description: "Areas of study show up once accounts join." } : undefined}
    action={<DropdownMenu>
      <DropdownMenuTrigger asChild><Button size="sm" variant="secondary">Select<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[calc(100vw-2rem)]">
        <DropdownMenuRadioGroup value={selected?.major ?? ""} onValueChange={setMajor} aria-label="Area of study">
          {data?.majors.map((segment) => <DropdownMenuRadioItem key={segment.major} value={segment.major} className="whitespace-normal break-words">{segment.major}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>}>
    {data && <div className="mx-auto flex w-full max-w-64 min-w-0 items-center gap-4 @min-[400px]/statistics:gap-8">
      <DistributionChart segments={data.majors.map((segment) => ({ label: segment.major, count: segment.count }))} selected={selected?.major} onSelect={setMajor}
        label="Account major distribution" className="shrink-0" visualClassName="hidden @min-[330px]/statistics:block" />
      <div aria-live="polite" className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-h2 tabular-nums"><User aria-hidden="true" className="size-4 shrink-0" />{(selected?.count ?? data.totalAccounts).toLocaleString("en-CA")}</span>
          {selected && <MetricBadge>{Math.round(selected.count / data.totalAccounts * 100)}%</MetricBadge>}
        </div>
        <p className="break-words text-label font-normal text-muted-foreground [overflow-wrap:anywhere]">{selected?.major ?? "All accounts"}</p>
      </div>
    </div>}
  </StatisticsCard>;
}
