"use client";

import { useRef, useState } from "react";
import { FileText, QrCode } from "lucide-react";
import { AgendaDayTable } from "@/components/shared/AgendaDayTable";
import { PageContainer } from "@/components/shared/PageContainer";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveAgendaNoteAction } from "@/features/admin/agenda-note-actions";
import { VolunteerScheduleButton } from "./VolunteerScheduleButton";
import { agendaCheckInHref, agendaPath } from "@/features/admin/lib/staff-agenda";
import { agendaDayLabel } from "@/lib/event-agenda";
import type { AgendaNote, StaffAgendaDay, StaffAgendaItem } from "@/lib/supabase-helpers/event-agenda-notes";

export function StaffAgenda({ eventId, eventName, days, initialDayId, volunteerUrl }: {
  eventId: string; eventName: string; days: StaffAgendaDay[]; initialDayId: string | null; volunteerUrl: string | null;
}) {
  const [dayId, setDayId] = useState(initialDayId);
  const [notes, setNotes] = useState<Record<string, AgendaNote>>(() => Object.fromEntries(days.flatMap(day => day.items.map(item => [item.id, item.note]))));
  const [editor, setEditor] = useState<{ item: StaffAgendaItem; body: string; revision: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<AgendaNote | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const day = days.find(entry => entry.id === dayId);
  function openNote(item: StaffAgendaItem, trigger: HTMLElement) {
    returnFocus.current = trigger;
    setEditor({ item, body: notes[item.id].body, revision: notes[item.id].revision });
    setError(null); setCurrent(null);
  }
  async function save() {
    if (!editor || saving.current || current) return;
    saving.current = true; setPending(true); setError(null);
    try {
      const result = await saveAgendaNoteAction({ eventId, itemId: editor.item.id, body: editor.body, expectedRevision: editor.revision });
      if (result.ok) { setNotes(previous => ({ ...previous, [editor.item.id]: result.note })); setEditor(null); }
      else { setError(result.error); setCurrent(result.current ?? null); }
    } catch { setError("Couldn’t save the note. Your text is still here. Try saving again."); }
    finally { saving.current = false; setPending(false); }
  }
  return <PageContainer backHref={`/admin/events/${eventId}`} backLabel="Back to Event overview" className="space-y-6">
    <h1 className="text-h1">{eventName} agenda</h1>
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {days.length > 1 && <div className="w-full min-w-0 sm:max-w-sm sm:flex-1"><Select value={dayId ?? undefined} onValueChange={id => { setDayId(id); window.history.replaceState(null, "", agendaPath(eventId, id)); }}><SelectTrigger aria-label="Day"><SelectValue /></SelectTrigger><SelectContent>{days.map(entry => <SelectItem key={entry.id} value={entry.id}>{agendaDayLabel(entry.date)} · {entry.title}</SelectItem>)}</SelectContent></Select></div>}
      <VolunteerScheduleButton eventId={eventId} initialUrl={volunteerUrl} />
    </div>
    <div data-agenda-container className="@container/agenda min-w-0">
      {day ? <><AgendaDayTable day={{ ...day, items: day.items.map(item => ({ ...item, location: item.location ?? day.location })) }} actions={item => [
        { label: "View Notes", icon: <FileText aria-hidden />, onSelect: (trigger: HTMLElement) => openNote(item, trigger) },
        ...(item.check_in ? [{ label: "Check In", icon: <QrCode aria-hidden />, href: agendaCheckInHref(eventId, item.id, day.id) }] : []),
      ]} />{!day.items.length && <p className="mt-4 text-muted-foreground">No agenda items for this day yet.</p>}</> : <p className="text-muted-foreground">No agenda days yet. Add days and items in the event builder.</p>}
    </div>
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !saving.current) setEditor(null); }}><DialogContent closeDisabled={pending} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}>
      <DialogHeader><DialogTitle>Notes · {editor?.item.title}</DialogTitle><DialogDescription>Shared with UX Hub execs. Save changes or cancel to keep the saved note.</DialogDescription></DialogHeader>
      <label htmlFor="agenda-note" className="text-small font-medium">Note for UX Hub execs</label><Textarea id="agenda-note" value={editor?.body ?? ""} disabled={pending} className="min-h-60 max-h-[50dvh]" onChange={event => setEditor(previous => previous ? { ...previous, body: event.target.value } : null)} />
      {error && <Alert variant="destructive" role="alert">{error}</Alert>}
      {current && <div className="space-y-3"><p className="text-small font-medium">Latest saved note</p><p className="max-h-40 overflow-auto whitespace-pre-wrap wrap-anywhere text-small">{current.body || "Empty note"}</p><Button variant="secondary" onClick={() => { setNotes(previous => ({ ...previous, [current.item_id]: current })); setEditor(previous => previous ? { ...previous, revision: current.revision } : null); setCurrent(null); setError(null); }}>Keep my text and use latest revision</Button><p className="text-small text-muted-foreground">Review and reconcile your text above before saving again.</p></div>}
      <DialogFooter><Button variant="secondary" disabled={pending} onClick={() => setEditor(null)}>Cancel</Button><Button disabled={pending || !!current} onClick={save}>{pending ? "Saving…" : "Save"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </PageContainer>;
}
