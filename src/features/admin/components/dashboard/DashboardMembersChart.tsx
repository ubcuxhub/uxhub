"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MembershipAnalytics } from "@/lib/supabase-helpers/admin-dashboard";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";

export function DashboardMembersChart({ data }: { data: MembershipAnalytics | null }) {
  if (!data) return <p role="status" className="py-24 text-center text-small text-fg-secondary">Membership statistics unavailable. Please try again later.</p>;
  const tiers = data.tiers.map((tier, index) => ({
    ...tier,
    name: formatMembershipTypeName(tier.name),
    key: `tier${index}`,
    color: `var(--chart-${index % 5 + 1})`,
    fill: `var(--color-tier${index})`,
  }));
  const config: ChartConfig = Object.fromEntries(
    tiers.map((tier) => [tier.key, { label: tier.name, color: tier.color }]),
  );
  const populatedTiers = tiers.filter((tier) => tier.count > 0);

  return (
    <div className="space-y-5">
      <h3 className="text-h3">Members</h3>
      {data.activeMembers > 0 ? (
        <ChartContainer config={config} className="mx-auto aspect-square max-h-64 w-full" aria-label={`${data.activeMembers} active members by membership tier`}>
          <PieChart accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel formatter={(value, _name, item) => (
              <span>{item.payload.name}: {Number(value).toLocaleString("en-CA")} ({Math.round(Number(value) / data.activeMembers * 100)}%)</span>
            )} />} />
            <Pie data={populatedTiers} dataKey="count" nameKey="key" innerRadius="65%" outerRadius="90%" strokeWidth={3} isAnimationActive={false}>
              {populatedTiers.map((tier) => <Cell key={tier.id} fill={tier.fill} />)}
              <Label content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                return <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">{data.activeMembers.toLocaleString("en-CA")}</tspan>
                  <tspan x={viewBox.cx} y={Number(viewBox.cy) + 26} className="fill-muted-foreground text-xs">Active members</tspan>
                </text>;
              }} />
            </Pie>
          </PieChart>
        </ChartContainer>
      ) : <div className="flex min-h-64 flex-col items-center justify-center gap-2"><p className="text-h1">0</p><p className="text-small text-fg-secondary">No active members</p></div>}
      <ul aria-label="Membership distribution" className="space-y-2 text-small">
        {tiers.map((tier) => <li key={tier.id} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: tier.color }} />{tier.name}</span>
          <span className="shrink-0 tabular-nums">{tier.count.toLocaleString("en-CA")} <span className="text-fg-secondary">({data.activeMembers ? Math.round(tier.count / data.activeMembers * 100) : 0}%)</span></span>
        </li>)}
      </ul>
      <p className="border-t pt-4 text-small text-fg-secondary"><span className="font-semibold text-foreground">{data.buyersLast30Days.toLocaleString("en-CA")}</span> membership buyers in the last 30 days</p>
    </div>
  );
}
