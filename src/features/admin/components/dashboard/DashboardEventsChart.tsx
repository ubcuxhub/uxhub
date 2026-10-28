"use client";

import { ArrowLeft, ArrowRight, Minus, Plus, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { EventAnalytics } from "@/lib/supabase-helpers/admin-dashboard";
import { useChartWindow } from "@/features/admin/hooks/use-chart-window";

const config = {
  registrations: { label: "Registrations", color: "var(--chart-1)" },
  attendees: { label: "Checked-in attendees", color: "var(--chart-2)" },
} satisfies ChartConfig;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Vancouver",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function DashboardEventsChart({ data }: { data: EventAnalytics | null }) {
  const total = data?.events.length ?? 0;
  const { window, onKeyDown, pan, zoom, reset } = useChartWindow(total);

  if (!data) {
    return (
      <p role="status" className="py-24 text-center text-small text-fg-secondary">
        Event statistics unavailable. Please try again later.
      </p>
    );
  }
  const visible = data.events.slice(window.start, window.start + window.size);

  return (
    <div className="space-y-5">
      <h3 className="text-h3">Events</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-h2 tabular-nums">
            {data.currentEvent ? data.currentEvent.registrations.toLocaleString("en-CA") : "—"}
          </p>
          <p className="text-label text-fg-secondary">
            {data.currentEvent ? `Registrations · ${data.currentEvent.name}` : "No upcoming event"}
          </p>
        </div>
        <div>
          <p className="text-h2 tabular-nums">{data.uniqueParticipants.toLocaleString("en-CA")}</p>
          <p className="text-label text-fg-secondary">
            Unique participants · {data.schoolYearLabel} (Sep–Apr)
          </p>
        </div>
      </div>
      {total === 0 ? <p className="py-20 text-center text-small text-fg-secondary">No published events to show.</p> : <>
        <div tabIndex={0} role="group" aria-label="Event registration and attendance chart" aria-describedby="event-chart-help"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onKeyDown={onKeyDown}>
          <ChartContainer config={config} className="h-64 w-full aspect-auto">
            <BarChart accessibilityLayer={false} data={visible} margin={{ left: -20, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="id" tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" minTickGap={8} tick={{ fontSize: 10 }}
                tickFormatter={(id) => {
                  const name = visible.find((event) => event.id === id)?.name ?? "";
                  return name.length > 9 ? `${name.slice(0, 8)}…` : name;
                }}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_label, payload) => {
                const event = visible.find((event) => event.id === payload[0]?.payload?.id);
                return event ? `${event.name} · ${dateFormatter.format(new Date(event.startsAt))}` : "";
              }} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="registrations" fill="var(--color-registrations)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="attendees" fill="var(--color-attendees)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2" role="group" aria-label="Event chart controls">
          <div className="flex gap-1">
            <Button variant="outline" size="icon" aria-label="Earlier events" disabled={window.start === 0} onClick={() => pan(-1)}>
              <ArrowLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Later events" disabled={window.start + window.size >= total} onClick={() => pan(1)}>
              <ArrowRight />
            </Button>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" aria-label="Zoom in" disabled={window.size <= 1} onClick={() => zoom(-1)}>
              <Plus />
            </Button>
            <Button variant="outline" size="icon" aria-label="Zoom out" disabled={window.size >= total} onClick={() => zoom(1)}>
              <Minus />
            </Button>
            <Button variant="outline" size="icon" aria-label="Reset event chart" onClick={reset}>
              <RotateCcw />
            </Button>
          </div>
        </div>
        <p aria-live="polite" className="text-label text-fg-secondary">Events {window.start + 1}–{window.start + window.size} of {total}</p>
        <p id="event-chart-help" className="text-label text-fg-secondary">Use the buttons to zoom. Focus the chart and use ← / → to explore events.</p>
        <details className="text-small">
          <summary className="cursor-pointer text-fg-secondary">View chart data</summary>
          <ul className="mt-2 space-y-2">
            {visible.map((event) => (
              <li key={event.id}>
                {event.name} · {dateFormatter.format(new Date(event.startsAt))}: {event.registrations} registrations, {event.attendees} checked-in attendees.
              </li>
            ))}
          </ul>
        </details>
      </>}
    </div>
  );
}
