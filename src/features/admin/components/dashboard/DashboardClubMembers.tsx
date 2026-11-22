"use client";

import { useState } from "react";
import { Info, User } from "lucide-react";
import { StatisticsCard } from "@/components/shared/StatisticsCard";
import { ScrollableBarChart, chartPeriodValue } from "@/components/shared/ScrollableBarChart";
import { ChartPeriodMenu } from "@/components/shared/ChartPeriodMenu";
import { IconButton } from "@/components/ui/icon-button";
import { MetricBadge } from "@/components/ui/metric-badge";
import type { MembershipHistory, MembershipHistoryPeriod } from "@/lib/supabase-helpers/admin-dashboard";

const monthFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short" });

export function DashboardClubMembers({ data, recentAdditions }: { data: MembershipHistory | null; recentAdditions?: MembershipHistoryPeriod | null }) {
  const [period, setPeriod] = useState<"year" | "month">("month");
  const [year, setYear] = useState(data?.latestAcademicYear);
  const available = data?.years.filter((item) => item.coverage !== "future") ?? [];
  const latest = data?.years.find((item) => item.academicYear === data.latestAcademicYear);
  const selected = available.find((item) => item.academicYear === year) ?? available.at(-1);
  const headline = period === "month" ? selected : latest;
  const range = available.length ? `${Math.min(...available.map((item) => item.academicYear))}–${Math.max(...available.map((item) => item.academicYear)) + 1}` : "";
  const empty = latest?.coverage === "complete" && latest.count === 0 && available.every((item) => item.coverage === "complete" && item.count === 0);
  const periods = period === "year" ? available.map((item) => ({ ...item, id: String(item.academicYear) })) : selected?.months.map((item) => ({ ...item, id: item.month, label: monthFormatter.format(new Date(`${item.month}T00:00:00Z`)) })) ?? [];
  return <StatisticsCard title="Club Members"
    titleAction={<IconButton label="Membership data collection began in the 2026-2027 academic year" variant="ghost" size="icon-sm"><Info /></IconButton>}
    message={!data ? { title: "We couldn’t load club members", description: "Refresh the page to try again." } : empty ? { title: "No members yet", description: "Sign-ups will show up here, by year." } : undefined}
    action={<ChartPeriodMenu period={period} years={available.map((item) => ({ value: item.academicYear, label: item.label })).sort((a, b) => b.value - a.value)} selectedYear={selected?.academicYear ?? data?.latestAcademicYear ?? 0}
      onChange={(nextPeriod, nextYear) => { setPeriod(nextPeriod); setYear(nextYear); }} />}>
    {data && <>
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1 text-h1 tabular-nums" aria-label={`Academic-year total: ${headline ? chartPeriodValue(headline, false) : "Data unavailable"}`}>
            <User aria-hidden="true" className="size-4 shrink-0" />{headline?.count?.toLocaleString("en-CA") ?? "—"}
          </span>
          {recentAdditions?.count != null && (period === "year" || selected?.academicYear === data.latestAcademicYear) && <MetricBadge trend>
            {`+${recentAdditions.count.toLocaleString("en-CA")} past 30 days`}
          </MetricBadge>}
        </div>
        <p className="text-label font-normal text-muted-foreground">{period === "month" ? selected?.label : range}</p>
      </div>
      <ScrollableBarChart key={`${period}:${selected?.academicYear}`} periods={periods} initialScroll={period === "month" ? "start" : "end"} showPartialCoverage={false} wideLabels={period === "year"} label={period === "year" ? "Academic-year members" : `${selected?.label} monthly additions`} />
    </>}
  </StatisticsCard>;
}
