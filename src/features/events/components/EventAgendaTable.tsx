"use client";

import { Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agendaDayLabel, agendaTimeRange, agendaWeeks } from "@/features/events/lib/event-agenda";
import { formatEventTime } from "@/lib/date";
import type { EventAgendaDay } from "@/lib/supabase-helpers/event-agenda";

export function EventAgendaTable({ eventName, agenda }: { eventName: string; agenda: EventAgendaDay[] }) {
  const weeks = agendaWeeks(agenda);
  if (!weeks.length) return null;
  const days = (entries: EventAgendaDay[]) => <div className="space-y-4">{entries.map(day => <div key={day.id} className="overflow-hidden rounded-lg border border-border-subtle">
    <div className="bg-secondary px-4 py-3">
      <h3 className="text-small font-medium">{agendaDayLabel(day.date)}<span className="font-normal text-muted-foreground"> · {day.title}</span></h3>
    </div>
    <Table aria-label={`${day.title ?? "Agenda"} on ${day.date}`} className="min-w-80 table-fixed" scrollerLabel={`${day.title ?? "Agenda"} schedule, scroll for locations`} scrollerClassName="focus-visible:focus-ring" >
      <colgroup>
        <col className="w-48 @min-[48rem]/agenda:w-56" />
        <col />
        <col className="hidden w-40 @min-[48rem]/agenda:table-column" />
        <col className="hidden w-24 @min-[48rem]/agenda:table-column" />
      </colgroup>
      <TableHeader className="sr-only"><TableRow><TableHead>Time</TableHead><TableHead>Item</TableHead><TableHead className="hidden @min-[48rem]/agenda:table-cell">Building or online location</TableHead><TableHead className="hidden @min-[48rem]/agenda:table-cell">Room</TableHead></TableRow></TableHeader>
      <TableBody>{[...day.items].sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "")).map(item => {
        const building = item.location?.restricted
          ? item.location.public_summary
          : item.location?.building || (item.location?.type === "online" ? "Online" : null);
        const room = item.location?.restricted ? null : item.location?.room;
        const location = [building, room].filter(Boolean).join(", ");
        return <TableRow key={item.id}>
          <TableCell className="px-4 py-3.5 align-top">
            <div className="flex items-start gap-2 text-small">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {item.starts_at && item.ends_at ? <span className="flex flex-col gap-x-1 @min-[48rem]/agenda:flex-row @min-[48rem]/agenda:flex-wrap">
                <span className="whitespace-nowrap">{formatEventTime(item.starts_at)} –</span>{" "}
                <span className="whitespace-nowrap">{formatEventTime(item.ends_at)}</span>
              </span> : <span>{agendaTimeRange(item)}</span>}
            </div>
          </TableCell>
          <TableCell className="px-4 py-3.5 align-top text-small wrap-anywhere">
            <p className="font-medium">{item.title}</p>
            {location && <p className="mt-1 font-normal text-muted-foreground @min-[48rem]/agenda:hidden">{location}</p>}
          </TableCell>
          <TableCell className="hidden px-4 py-3.5 align-top text-small text-muted-foreground wrap-anywhere @min-[48rem]/agenda:table-cell">{building}</TableCell>
          <TableCell className="hidden px-4 py-3.5 align-top text-small text-muted-foreground wrap-anywhere @min-[48rem]/agenda:table-cell">{room}</TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>
  </div>)}</div>;
  return <section aria-label={`${eventName} agenda`} className="min-w-0">
    <Card className="@container/agenda gap-0 py-0">
      <CardHeader className="gap-0.5 border-b px-5 pt-5 [.border-b]:pb-4"><CardTitle><h2>Agenda</h2></CardTitle><CardDescription>All times are Pacific Time</CardDescription></CardHeader>
      <CardContent className="min-w-0 p-5">{weeks.length === 1 ? days(weeks[0].days) : <Tabs defaultValue={String(weeks[0].number)}>
        <TabsList aria-label="Agenda weeks">{weeks.map(week => <TabsTrigger className="border border-border-subtle data-[state=active]:border-transparent" key={week.number} value={String(week.number)}>Week {week.number}</TabsTrigger>)}</TabsList>
        {weeks.map(week => <TabsContent key={week.number} value={String(week.number)} className="mt-4">{days(week.days)}</TabsContent>)}
      </Tabs>}</CardContent>
    </Card>
  </section>;
}
