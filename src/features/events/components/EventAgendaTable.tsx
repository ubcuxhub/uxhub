"use client";

import { AgendaDayTable } from "@/components/shared/AgendaDayTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agendaPages, defaultAgendaPage } from "@/lib/event-agenda";
import type { EventAgendaDay } from "@/lib/supabase-helpers/event-agenda";

/**
 * The event page agenda (Figma "Agenda": single day 4644:169, multi-day
 * 4623:165, multi-week 4616:838). Tabs per week or per day as `agendaPages`
 * decides, except a single day, which shows on its own without tabs, opening on today's tab (`today`, a Pacific YYYY-MM-DD from the
 * server so the first render matches). `itemLinks` maps an agenda item's id to
 * the URL its title links to (4640:844).
 */
export function EventAgendaTable({ eventName, agenda, today, itemLinks = {} }: {
  eventName: string;
  agenda: EventAgendaDay[];
  today?: string;
  itemLinks?: Record<string, string>;
}) {
  const pages = agendaPages(agenda);
  if (!pages.length) return null;
  const byDay = pages[0].key === pages[0].days[0].id;
  const days = (entries: EventAgendaDay[]) => <div className="space-y-6">{entries.map(day => <AgendaDayTable key={day.id} day={{
    ...day,
    items: day.items.map(item => ({ ...item, link: itemLinks[item.id] ? { url: itemLinks[item.id] } : null })),
  }} />)}</div>;
  return <section aria-label={`${eventName} agenda`} className="min-w-0">
    <Card data-agenda-container className="@container/agenda gap-0 py-0">
      <CardHeader className="gap-0.5 border-b px-5 pt-5 [.border-b]:pb-4"><CardTitle><h2>Agenda</h2></CardTitle><CardDescription>All times are Pacific Time</CardDescription></CardHeader>
      <CardContent className="min-w-0 p-5">{pages.length === 1 ? days(pages[0].days) : <Tabs defaultValue={defaultAgendaPage(pages, today)}>
        <TabsList aria-label={byDay ? "Agenda days" : "Agenda weeks"}>{pages.map(page => <TabsTrigger className="border border-border-subtle data-[state=active]:border-transparent" key={page.key} value={page.key}>{page.label}</TabsTrigger>)}</TabsList>
        {pages.map(page => <TabsContent key={page.key} value={page.key} className="mt-4">{days(page.days)}</TabsContent>)}
      </Tabs>}</CardContent>
    </Card>
  </section>;
}
