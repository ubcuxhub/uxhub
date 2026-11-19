"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowButton } from "@/components/ui/table";
import { agendaDayLabel, agendaTimeRange } from "@/lib/event-agenda";
import { cn } from "@/lib/utils";
import type { ParticipantLocation } from "@/lib/location";

export interface AgendaTableItem {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  location: ParticipantLocation | null;
  /** Opens in a new tab from the item's title (participant rows only). */
  link?: { url: string } | null;
}
export interface AgendaTableAction {
  label: string;
  icon: ReactNode;
  href?: string;
  onSelect?: (trigger: HTMLElement) => void;
}

function ActionButtons({ actions, close, returnFocus }: { actions: AgendaTableAction[]; close?: () => void; returnFocus?: () => HTMLElement | null }) {
  return actions.map(action => action.href
    ? <Button key={action.label} asChild variant="secondary" size="sm"><Link href={action.href} onClick={close}>{action.icon}{action.label}</Link></Button>
    : <Button key={action.label} variant="secondary" size="sm" onClick={event => { const trigger = returnFocus?.() ?? event.currentTarget; close?.(); action.onSelect?.(trigger); }}>{action.icon}{action.label}</Button>);
}

function AgendaRow({ item, actions, children }: { item: AgendaTableItem; actions?: AgendaTableAction[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLTableRowElement>(null);
  const selecting = useRef(false);
  useEffect(() => {
    if (!open || !row.current) return;
    const container = row.current.closest("[data-agenda-container]");
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const trigger = row.current?.querySelector<HTMLButtonElement>("[data-table-row-opener]");
      if (trigger && getComputedStyle(trigger).display === "none") setOpen(false);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [open]);
  if (!actions) return <TableRow>{children}</TableRow>;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverAnchor asChild><TableRow ref={row}>
      {children}
      <TableCell className="hidden px-4 py-3.5 align-top @min-[48rem]/agenda:table-cell"><div className="flex flex-col items-start gap-2"><ActionButtons actions={actions} /></div></TableCell>
    </TableRow></PopoverAnchor>
    <PopoverContent align="end" aria-label={`Actions for ${item.title}`} className="flex w-auto flex-col gap-2" onCloseAutoFocus={event => {
      // A chosen action may have opened a dialog; do not pull focus out of it.
      event.preventDefault();
      if (!selecting.current) {
        const trigger = row.current?.querySelector<HTMLButtonElement>("[data-table-row-opener]");
        if (trigger && getComputedStyle(trigger).display !== "none") trigger.focus();
        else row.current?.querySelector<HTMLElement>("td:last-child button, td:last-child a")?.focus();
      }
      selecting.current = false;
    }}><ActionButtons actions={actions} returnFocus={() => row.current?.querySelector<HTMLButtonElement>("[data-table-row-opener]") ?? null} close={() => { selecting.current = true; setOpen(false); }} /></PopoverContent>
  </Popover>;
}

/** A location's building column: the public summary for a restricted viewer, "Online" for an online-only place. */
function buildingLabel(location: ParticipantLocation | null | undefined): string | null {
  if (!location) return null;
  return location.restricted
    ? location.public_summary ?? null
    : location.building || (location.type === "online" ? "Online" : null);
}

export function AgendaDayTable<T extends AgendaTableItem>({ day, actions }: {
  /** `location` shows in the heading only when the day set its own (`location_overridden`). */
  day: { id: string; date: string; title: string | null; items: T[]; location?: ParticipantLocation | null; location_overridden?: boolean };
  actions?: (item: T) => AgendaTableAction[];
}) {
  const dayLocation = day.location_overridden ? buildingLabel(day.location) : null;
  const headingDetails = [day.title, dayLocation].filter(Boolean);
  return <div key={day.id} className="overflow-hidden rounded-lg border border-border-subtle">
    <div className="bg-secondary px-4 py-3">
      <h3 className="text-small font-medium">{agendaDayLabel(day.date)}{headingDetails.map(detail => <span key={detail} className="font-normal text-muted-foreground"> · {detail}</span>)}</h3>
    </div>
    <Table aria-label={`${day.title ?? "Agenda"} on ${day.date}`} className="min-w-80 table-fixed" scrollerLabel={`${day.title ?? "Agenda"} schedule, scroll for locations`} scrollerClassName="focus-visible:focus-ring" >
      <colgroup>
        <col className={cn("w-48", actions ? "@min-[48rem]/agenda:w-[24%]" : "@min-[48rem]/agenda:w-56")} />
        <col className={actions ? "@min-[48rem]/agenda:w-[24%]" : undefined} />
        <col className={cn("hidden @min-[48rem]/agenda:table-column", actions ? "@min-[48rem]/agenda:w-[20%]" : "w-40")} />
        <col className={cn("hidden @min-[48rem]/agenda:table-column", actions ? "@min-[48rem]/agenda:w-[12%]" : "w-24")} />
        {actions && <col className="hidden @min-[48rem]/agenda:w-[20%] @min-[48rem]/agenda:table-column" />}
      </colgroup>
      <TableHeader className="sr-only"><TableRow><TableHead>Time</TableHead><TableHead>Item</TableHead><TableHead className="hidden @min-[48rem]/agenda:table-cell">Building or online location</TableHead><TableHead className="hidden @min-[48rem]/agenda:table-cell">Room</TableHead>{actions && <TableHead className="hidden @min-[48rem]/agenda:table-cell">Actions</TableHead>}</TableRow></TableHeader>
      <TableBody>{[...day.items].sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "")).map(item => {
        const building = buildingLabel(item.location);
        const room = item.location?.restricted ? null : item.location?.room;
        const location = [building, room].filter(Boolean).join(", ");
        return <AgendaRow key={item.id} item={item} actions={actions?.(item)}>
          <TableCell className="px-4 py-3.5 align-top">
            <div className="flex items-start gap-2 text-small">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className={item.starts_at && item.ends_at ? "whitespace-nowrap" : undefined}>{agendaTimeRange(item)}</span>
            </div>
          </TableCell>
          <TableCell className="px-4 py-3.5 align-top text-small wrap-anywhere">
            {actions ? <AgendaRowTrigger title={item.title} /> : item.link ? <p className="font-medium">
              <a href={item.link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline focus-visible:focus-ring rounded-sm">
                {item.title}<ArrowUpRight className="size-4 shrink-0" aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p> : <p className="font-medium">{item.title}</p>}
            {location && <p className="mt-1 font-normal text-muted-foreground @min-[48rem]/agenda:hidden">{location}</p>}
          </TableCell>
          <TableCell className="hidden px-4 py-3.5 align-top text-small text-muted-foreground wrap-anywhere @min-[48rem]/agenda:table-cell">{building}</TableCell>
          <TableCell className="hidden px-4 py-3.5 align-top text-small text-muted-foreground wrap-anywhere @min-[48rem]/agenda:table-cell">{room}</TableCell>
        </AgendaRow>;
      })}</TableBody>
    </Table>
  </div>;
}

function AgendaRowTrigger({ title }: { title: string }) {
  return <><p className="hidden font-medium @min-[48rem]/agenda:block">{title}</p><PopoverTrigger asChild><TableRowButton className="font-medium @min-[48rem]/agenda:hidden" aria-label={`Actions for ${title}`}>{title}</TableRowButton></PopoverTrigger></>;
}
