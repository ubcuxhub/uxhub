"use client";

import { useId, useState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DateField, TimeField } from "@/components/ui/date-time-field";
import { Field, FieldLabel, FieldDescription, FieldError, FieldSet, FieldLegend, FieldContent } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SegmentedToggle, SegmentedToggleItem } from "@/components/ui/segmented-toggle";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { strictPacificTimestamp } from "@/lib/date";
import { formatDateInput, type IsoDate, type WallTime } from "@/lib/date-input";
import { usePacificNow } from "@/hooks/use-pacific-now";
import { emptyEventDate, emptyLocation, dateLocationProblem, type LocationDraft, type EventDateLocationDraft } from "../../lib/event-date-location";

function LocationFields({ value, onChange, restricted }: { value: LocationDraft; onChange: (value: LocationDraft) => void; restricted: boolean }) {
  const uid = useId();
  const field = (key: Exclude<keyof LocationDraft, "type">, label: string, placeholder: string, type = "text") => <Field key={key}>
    <FieldLabel htmlFor={`${uid}-${key}`}>{label}</FieldLabel>
    <Input id={`${uid}-${key}`} type={type} value={value[key]} placeholder={placeholder} onChange={event => onChange({ ...value, [key]: event.target.value })} />
    {key === "public_summary" && <FieldDescription>Everyone who can see the event can see this summary. Keep exact private details out of it.</FieldDescription>}
  </Field>;
  return <div className="space-y-4">
    <SegmentedToggle aria-label="Location type" value={value.type} onValueChange={type => onChange({ ...value, type: type as LocationDraft["type"] })}>
      <SegmentedToggleItem value="in_person">In person</SegmentedToggleItem><SegmentedToggleItem value="online">Online</SegmentedToggleItem><SegmentedToggleItem value="hybrid">Hybrid</SegmentedToggleItem>
    </SegmentedToggle>
    {value.type !== "online" && <div className="grid gap-4 sm:grid-cols-2">
      {field("building", "Building", "E.g. AMS Student Nest")}{field("room", "Room (optional)", "E.g. Room 2306")}
      {field("address", "Street address", "E.g. 6133 University Blvd, Vancouver")}{field("map_url", "Map link (optional)", "Paste a map link", "url")}
    </div>}
    {value.type !== "in_person" && <div className="grid gap-4 sm:grid-cols-2">
      {field("meeting_url", "Meeting link", "https://", "url")}{field("meeting_id", "Meeting ID (optional)", "E.g. 123 456 789")}{field("meeting_passcode", "Passcode (optional)", "Meeting passcode")}
    </div>}
    {restricted && field("public_summary", "Public location summary", "E.g. UBC Vancouver; exact room shared with confirmed attendees")}
  </div>;
}

function DateRow({ row, index, canRemove, onChange, onRemove }: { row: EventDateLocationDraft["dates"][number]; index: number; canRemove: boolean; onChange: (row: EventDateLocationDraft["dates"][number]) => void; onRemove: () => void }) {
  const uid = useId();
  const [dateError, setDateError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);
  const start = row.date && row.start ? strictPacificTimestamp(`${row.date}T${row.start}`) : null;
  const end = row.date && row.end ? strictPacificTimestamp(`${row.date}T${row.end}`) : null;
  const invalid = (row.date && row.start && !start) || (row.date && row.end && !end);
  const error = dateError ?? startError ?? endError ?? (invalid ? "Use an unambiguous, valid Pacific time." : start && end && end <= start ? "End must be after start." : null);
  return <FieldSet className="gap-3">
    <FieldLegend className="sr-only">Event date {index + 1}</FieldLegend>
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1.7fr_auto]">
      <Field data-invalid={!!dateError}><FieldLabel htmlFor={`${uid}-date`}>Date</FieldLabel><DateField id={`${uid}-date`} aria-describedby={error ? `${uid}-error` : undefined} aria-invalid={!!error} value={(row.date || null) as IsoDate | null} onValueChange={date => onChange({ ...row, date: date ?? "" })} onValidityChange={setDateError} /></Field>
      <Field data-invalid={!!startError}><FieldLabel htmlFor={`${uid}-start`}>Starts</FieldLabel><TimeField id={`${uid}-start`} aria-describedby={error ? `${uid}-error` : undefined} aria-invalid={!!error} ambiguousStart="daytime" value={(row.start || null) as WallTime | null} onValueChange={start => onChange({ ...row, start: start ?? "" })} onValidityChange={setStartError} /></Field>
      <Field data-invalid={!!endError}><FieldLabel htmlFor={`${uid}-end`}>Ends</FieldLabel><TimeField id={`${uid}-end`} aria-describedby={error ? `${uid}-error` : undefined} aria-invalid={!!error} placeholder="5:00 PM" after={(row.start || undefined) as WallTime | undefined} value={(row.end || null) as WallTime | null} onValueChange={end => onChange({ ...row, end: end ?? "" })} onValidityChange={setEndError} /></Field>
      <Field><FieldLabel htmlFor={`${uid}-label`}>Label (optional)</FieldLabel><Input id={`${uid}-label`} value={row.label} placeholder="E.g. Opening ceremony" onChange={event => onChange({ ...row, label: event.target.value })} /></Field>
      <IconButton className="self-end" label={`Remove date ${index + 1}`} disabled={!canRemove} onClick={onRemove}><Trash2 /></IconButton>
    </div>
    {error && <FieldError id={`${uid}-error`}>{error}</FieldError>}
    {!canRemove && row.session_id && <FieldDescription>Started dates cannot be removed.</FieldDescription>}
  </FieldSet>;
}

export function EventDateLocation({ value, onChange, disabled, showErrors }: { value: EventDateLocationDraft; onChange: (value: EventDateLocationDraft) => void; disabled: boolean; showErrors: boolean }) {
  const uid = useId();
  const now = usePacificNow();
  const [initialDates] = useState(value.dates);
  const [resetKey, setResetKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const resetButtonId = `${uid}-add-location`;
  const locationDateRef = useRef<HTMLButtonElement>(null);
  const updateRow = (key: string, update: Partial<EventDateLocationDraft["dates"][number]>) => onChange({ ...value, dates: value.dates.map(row => row.key === key ? { ...row, ...update } : row) });
  const completedDates = value.dates.filter(row => row.date);
  const eligible = completedDates.filter(row => !row.location);
  const canAddLocation = completedDates.length >= 2 && eligible.length > 0;
  const error = showErrors ? dateLocationProblem(value) : null;
  return <fieldset disabled={disabled} className="space-y-4 min-w-0">
    <legend className="sr-only">Date and location settings</legend>
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Dates and times</CardTitle><CardDescription className="text-body">Times are always shown in Pacific Time (Vancouver).</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="space-y-4 px-5">
      {value.dates.map((row, index) => <DateRow key={row.key} row={row} index={index} canRemove={value.dates.length > 1 && (!row.session_id || !!now && `${initialDates.find(item => item.key === row.key)?.date ?? row.date}T${initialDates.find(item => item.key === row.key)?.start ?? row.start}` > `${now.date}T${now.time}`)} onChange={next => updateRow(row.key, next)} onRemove={() => onChange({ ...value, dates: value.dates.filter(item => item.key !== row.key) })} />)}
      <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => onChange({ ...value, dates: [...value.dates, emptyEventDate()] })}>+ Add date</Button>
    </CardContent></Card>
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Location</CardTitle><CardDescription className="text-body">Where it happens, and who gets to see the details.</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="space-y-5 px-5">
      <LocationFields value={value.location} restricted={value.audience === "going"} onChange={location => onChange({ ...value, location })} />
      <Card role="group" aria-labelledby={`${uid}-different-location`} className="min-w-0 gap-4 bg-muted py-4"><CardHeader className="px-4"><CardTitle id={`${uid}-different-location`}>Different location on some dates</CardTitle><CardDescription>The location above is the default. Add a date that happens somewhere else.</CardDescription></CardHeader><CardContent className="space-y-4 px-4">
        <Field><FieldLabel htmlFor={resetButtonId}>Date for a different location</FieldLabel><Select value={selectedDate} onValueChange={setSelectedDate} disabled={!canAddLocation}><SelectTrigger ref={locationDateRef} id={resetButtonId}><SelectValue placeholder="Choose a date" /></SelectTrigger><SelectContent>{eligible.map(row => <SelectItem key={row.key} value={row.key}>{formatDateInput(row.date as IsoDate)}{row.label ? ` · ${row.label}` : ""}</SelectItem>)}</SelectContent></Select></Field>
        <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal sm:min-h-(--size-control)" disabled={!canAddLocation || !eligible.some(row => row.key === selectedDate)} onClick={() => { updateRow(selectedDate, { location: { ...emptyLocation() } }); setSelectedDate(""); }}>+ Add a different location for a date</Button>
        {completedDates.length < 2 && <FieldDescription>Fill in at least two calendar dates in Dates and times first.</FieldDescription>}
        {value.dates.filter(row => row.location).map(row => <Card key={row.key} role="group" aria-labelledby={`${uid}-${row.key}-location`} className="min-w-0 gap-4 py-4"><CardHeader className="px-4"><CardTitle id={`${uid}-${row.key}-location`} className="break-words">{row.date ? formatDateInput(row.date as IsoDate) : "Choose a date above"}{row.label ? ` · ${row.label}` : ""}</CardTitle><CardDescription>Audience: {value.audience === "going" ? "Going ticket holders and staff" : "Everyone who can see the event"}. This replaces the whole default location for this date.</CardDescription></CardHeader><CardContent className="space-y-4 px-4"><LocationFields value={row.location!} restricted={value.audience === "going"} onChange={location => updateRow(row.key, { location })} /><Button type="button" variant="outline" onClick={() => setResetKey(row.key)}>Use default location</Button></CardContent></Card>)}
      </CardContent></Card>
      <FieldSet><FieldLegend>Who can see the location</FieldLegend><RadioGroup value={value.audience} onValueChange={audience => onChange({ ...value, audience: audience as EventDateLocationDraft["audience"] })} className="sm:grid-cols-2">
        {([["everyone", "Everyone", "Anyone who can see the event."], ["going", "Confirmed attendees only", "Going ticket holders and staff. An accepted offer alone does not grant access."]] as const).map(([choice, label, description]) => <FieldLabel key={choice}><Field orientation="horizontal"><RadioGroupItem value={choice} /><FieldContent><span>{label}</span><FieldDescription>{description}</FieldDescription></FieldContent></Field></FieldLabel>)}
      </RadioGroup></FieldSet>
      {error && <FieldError>{error}</FieldError>}
    </CardContent></Card>
    <ConfirmDialog returnFocusRef={locationDateRef} open={resetKey !== null} onOpenChange={open => { if (!open) setResetKey(null); }} title="Use the default location?" description="This removes this date’s different location and its details. The date will follow future changes to the default location." confirmLabel="Use default location" confirmVariant="default" onConfirm={() => { if (resetKey) updateRow(resetKey, { location: null }); setResetKey(null); }} />
  </fieldset>;
}
