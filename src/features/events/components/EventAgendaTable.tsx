"use client";

import { AgendaDayTable } from "@/components/shared/AgendaDayTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agendaWeeks } from "@/lib/event-agenda";
import type { EventAgendaDay } from "@/lib/supabase-helpers/event-agenda";

export function EventAgendaTable({ eventName, agenda }: { eventName: string; agenda: EventAgendaDay[] }) {
  const weeks = agendaWeeks(agenda);
  if (!weeks.length) return null;
  const days = (entries: EventAgendaDay[]) => <div className="space-y-4">{entries.map(day => <AgendaDayTable key={day.id} day={day} />)}</div>;
  return <section aria-label={`${eventName} agenda`} className="min-w-0">
    <Card data-agenda-container className="@container/agenda gap-0 py-0">
      <CardHeader className="gap-0.5 border-b px-5 pt-5 [.border-b]:pb-4"><CardTitle><h2>Agenda</h2></CardTitle><CardDescription>All times are Pacific Time</CardDescription></CardHeader>
      <CardContent className="min-w-0 p-5">{weeks.length === 1 ? days(weeks[0].days) : <Tabs defaultValue={String(weeks[0].number)}>
        <TabsList aria-label="Agenda weeks">{weeks.map(week => <TabsTrigger className="border border-border-subtle data-[state=active]:border-transparent" key={week.number} value={String(week.number)}>Week {week.number}</TabsTrigger>)}</TabsList>
        {weeks.map(week => <TabsContent key={week.number} value={String(week.number)} className="mt-4">{days(week.days)}</TabsContent>)}
      </Tabs>}</CardContent>
    </Card>
  </section>;
}
