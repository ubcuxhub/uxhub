"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Scan } from "lucide-react";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { ListRow } from "@/components/shared/ListRow";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { StatCard } from "@/components/ui/stat-card";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { SearchField } from "@/components/ui/search-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { CheckInTarget, checkInItemContext } from "./CheckInTarget";
import { CheckInTicketMenu } from "./CheckInTicketMenu";
import { CheckInFeedback } from "./CheckInFeedback";
import { ScanTicketsCard } from "./ScanTicketsCard";
import { useItemCheckIn } from "@/features/admin/hooks/use-item-check-in";
import { checkInBackLabel, checkInReturnTo, checkInPath, type ItemCheckInSnapshot, type ItemAttendance } from "@/features/admin/lib/item-check-in";
import { searchCheckInAttendees } from "@/features/admin/lib/check-in-search";
import type { EventRow } from "@/lib/supabase/models";
import { formatEventTime } from "@/lib/date";

export function CheckInManager({ eventId, initialItemId, initialSnapshot, phoneLinks, returnTo }: { eventId: string; /** Named by the event manager's header. */ event: EventRow; initialItemId: string | null; initialSnapshot: ItemCheckInSnapshot; phoneLinks: Record<string, ReactNode>; returnTo?: string }) {
  const state = useItemCheckIn(eventId, initialItemId, initialSnapshot, false, returnTo);
  const { snapshot, itemId } = state;
  const [filter, setFilter] = useState<"not" | "checked" | "all">("not");
  const [search, setSearch] = useState("");
  const [viewAll, setViewAll] = useState(false);
  const [undoRow, setUndoRow] = useState<ItemAttendance | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const attendance = new Map(snapshot.attendance.map(a => [a.ticketId, a]));
  const total = snapshot.attendees.length;
  const count = attendance.size;
  const target = snapshot.items.find(i => i.id === itemId);
  const matches = searchCheckInAttendees(snapshot.attendees, search).filter(a => filter === "all" || (filter === "checked" ? attendance.has(a.id) : !attendance.has(a.id)));
  const name = (ticketId: string) => snapshot.attendees.find(a => a.id === ticketId)?.user_name ?? "Unknown User";
  const undo = async (row: ItemAttendance, selected = itemId) => {
    try {
      await state.undo(row, selected);
      toast.success("Check-in undone");
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't undo check-in. Try again.");
    }
  };
  const manual = async (ticketId: string) => {
    try {
      const result = await state.mutate({ ticketId });
      if (!result)
        return;
      if (result.status === "checked_in" || result.status === "already_checked_in") {
        const row: ItemAttendance = { ticketId: result.ticketId, attendanceVersion: result.attendanceVersion, checkedInAt: result.checkedInAt, method: "manual", operator: null };
        // Count comes from the committed transaction, never an optimistic increment.
        toast.success(result.status === "checked_in" ? `${result.name} checked in` : `${result.name} is already checked in`, {
          description: `${target?.label} · ${result.checkedCount} of ${result.total} checked in`,
          action: result.status === "checked_in" ? { label: "Undo check-in", onClick: () => void undo(row, itemId) } : undefined,
        });
      } else
        toast.error("Ticket not recognized. Refresh the attendee list and try again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't check in. Try again.");
    }
  };
  const rowAction = (row: ItemAttendance) => <IconButton label={`Undo check-in for ${name(row.ticketId)}`} variant="secondary" disabled={!state.enabled} onClick={() => {
    setUndoError(null);
    setUndoRow(row);
  }}>
    <MoreHorizontal />
  </IconButton>;
  // The event manager's header names the event and links back to the list,
  // so only a page this one was opened from (the agenda) gets a back link.
  const backHref = returnTo === undefined ? null : checkInReturnTo(returnTo);
  const back = backHref && backHref !== "/admin/events" ? backHref : undefined;
  return <PageContainer backHref={back} backLabel={back && checkInBackLabel(back)} className="@container/checkin flex flex-col gap-6">
    <h2 className="text-h3">Check-in</h2>
    {snapshot.items.length ? <CheckInTarget items={snapshot.items} itemId={itemId} onChange={id => {
      setUndoRow(null);
      state.selectItem(id);
    }} /> : null}
    <CheckInFeedback state={state} eventId={eventId} />
    {target ? <>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Checked in" {...(state.loading ? { kind: "loading" as const } : { kind: "count" as const, count, total, noun: "going", showRate: true })} />
        <StatCard label="Not checked in" {...(state.loading ? { kind: "loading" as const } : { kind: "count" as const, count: total - count, total, noun: "going" })} />
      </div>
      <ScanTicketsCard description={`${target.label} · ${checkInItemContext(target)}`}>
        <Button asChild={state.enabled} disabled={!state.enabled}>{state.enabled ? <Link href={checkInPath(eventId, itemId, true, returnTo)}>
          <Scan aria-hidden />Scan tickets</Link> : <>
          <Scan aria-hidden />Scan tickets</>}</Button>
        {itemId && phoneLinks[itemId] ? <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" className="hidden sm:inline-flex">Open scanner on phone</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open scanner on phone</DialogTitle>
              <DialogDescription>Scan this link to check tickets into {target.label}.</DialogDescription>
            </DialogHeader>{phoneLinks[itemId]}<Button asChild>
              <Link href={checkInPath(eventId, itemId, true, returnTo)}>Open scanner</Link>
            </Button>
          </DialogContent>
        </Dialog> : null}
      </ScanTicketsCard>
      <div className="grid min-w-0 gap-8 @[56rem]/checkin:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-4" aria-label="Recent check-ins">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-subheading">Recent check-ins</h3>{count > 3 ? <Button variant="ghost" size="sm" onClick={() => setViewAll(!viewAll)}>{viewAll ? "Show less" : `View all ${count}`}</Button> : null}</div>
          {count ? <ul className="overflow-hidden rounded-xl border border-border">{snapshot.attendance.slice(0, viewAll ? undefined : 3).map(row => <ListRow key={row.attendanceVersion} variant="compact" name={name(row.ticketId)} leading={formatEventTime(row.checkedInAt)} description={row.method ? `${row.method === "scan" ? "Scanned" : "Checked in manually"} · ${row.operator ?? "Unknown operator"}` : "Operator and method unknown"} action={rowAction(row)} />)}</ul> : <EmptyState size="inline" title="No check-ins yet" description="Check in an attendee to see activity here." />}
        </section>
        <section className="flex min-w-0 flex-col gap-4" aria-label="Attendees">
          <div className="flex items-center justify-between">
            <h3 className="text-subheading">Attendees</h3>
            <span className="text-label text-muted-foreground">{total} going</span>
          </div>
          <FilterChipGroup aria-label="Attendance">
            <FilterChip pressed={filter === "not"} onPressedChange={() => setFilter("not")} count={total - count}>Not checked in ·</FilterChip>
            <FilterChip pressed={filter === "checked"} onPressedChange={() => setFilter("checked")} count={count}>Checked in ·</FilterChip>
            <FilterChip pressed={filter === "all"} onPressedChange={() => setFilter("all")} count={total}>All ·</FilterChip>
          </FilterChipGroup>
          <SearchField label="Search attendees" placeholder="Search attendees" value={search} onValueChange={setSearch} resultCount={matches.length} />
          {matches.length ? <ul className="overflow-hidden rounded-xl border border-border">{matches.map(a => {
            const row = attendance.get(a.id);
            return <ListRow key={a.id} variant="compact" name={a.user_name} supporting={row ? <StatusBadge status="checked_in" label={`Checked in at ${formatEventTime(row.checkedInAt)}`} /> : null} action={<div className="flex items-center gap-1">{row ? rowAction(row) : <Button variant="secondary" disabled={!state.enabled} onClick={() => void manual(a.id)}>Check in</Button>}<CheckInTicketMenu attendee={a} onVoided={() => { void state.refresh(); }} /></div>} />;
          })}</ul> : <EmptyState size="inline" title={total ? "No attendees match" : "No attendees yet"} description={total ? "Try another search or filter." : "Valid ticket holders will appear here."} actions={total ? <Button variant="secondary" onClick={() => {
            setSearch("");
            setFilter("all");
          }}>{search ? "Clear search" : "Show all"}</Button> : undefined} />}
        </section>
      </div>
    </> : null}
    <ConfirmDialog open={!!undoRow} onOpenChange={open => {
      if (!open)
        setUndoRow(null);
    }} title="Undo check-in" description={undoRow ? `${name(undoRow.ticketId)} will go back to Going for ${target?.label}. The checked-in count changes from ${count} to ${Math.max(0, count - 1)}. You can check them in again at any time.` : ""} confirmLabel="Undo check-in" confirmVariant="default" pending={state.busy} error={undoError} onConfirm={() => {
      if (!undoRow)
        return;
      if (!state.enabled) {
        setUndoError("Reconnect and refresh before undoing attendance.");
        return;
      }
      void state.undo(undoRow).then(() => {
        setUndoRow(null);
        toast.success("Check-in undone");
      }).catch(e => setUndoError(e instanceof Error ? e.message : "Couldn't undo. Try again."));
    }} />
  </PageContainer>;
}
