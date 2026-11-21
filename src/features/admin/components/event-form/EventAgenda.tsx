"use client";

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LocationEditor } from "@/components/shared/LocationEditor";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { DateField, TimeField } from "@/components/ui/date-time-field";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { IsoDate, WallTime } from "@/lib/date-input";
import { agendaProjection, dateLocationIssues, emptyAgendaDay, emptyAgendaItem, emptyLocation, type AgendaItemDraft, type EventDateDraft, type EventDateLocationDraft } from "../../lib/event-date-location";
import { EventSchedule } from "./EventSchedule";

function AgendaItem({ day, item, index, restricted, onChange, onRemove, showErrors }: {
  day: EventDateDraft; item: AgendaItemDraft; index: number; restricted: boolean;
  onChange: (item: AgendaItemDraft) => void; onRemove: () => void; showErrors: boolean;
}) {
  const uid = `item-${item.key}`;
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const report = (field: string) => (message: string | null) => setErrors(current => ({ ...current, [field]: message }));
  const issues = showErrors ? dateLocationIssues({ version: 2, automatic: true, audience: restricted ? "going" : "everyone", location: day.location!, dates: [{ ...day, items: [item] }] }).filter(issue => issue.target.startsWith(uid)) : [];
  const controlError = Object.values(errors).find(Boolean);
  return <Card className="min-w-0 gap-4 bg-muted py-4" role="group" aria-labelledby={`${uid}-heading`}>
    <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-4">
      <CardTitle id={`${uid}-heading`}>Item {index + 1}</CardTitle>
      <IconButton label={`Remove item ${index + 1}`} disabled={item.attended} onClick={onRemove}><Trash2 /></IconButton>
    </CardHeader>
    <CardContent className="space-y-4 px-4">
      <Field validationKey={`${uid}-label`}><FieldLabel htmlFor={`${uid}-label`}>Item label</FieldLabel><Input id={`${uid}-label`} value={item.label} onChange={event => onChange({ ...item, label: event.target.value })} /></Field>
      <div className="grid gap-4 lg:grid-cols-3">
        <Field validationKey={`${uid}-start`}><FieldLabel htmlFor={`${uid}-start`}>Starts</FieldLabel><TimeField id={`${uid}-start`} ambiguousStart="daytime" value={(item.start || null) as WallTime | null} onValueChange={start => onChange({ ...item, start: start ?? "" })} onValidityChange={report("start")} /><FieldDescription>On the day’s date.</FieldDescription></Field>
        <Field validationKey={`${uid}-end_date`}><FieldLabel htmlFor={`${uid}-end_date`}>End date</FieldLabel><DateField id={`${uid}-end_date`} value={(item.end_date || null) as IsoDate | null} onValueChange={end_date => onChange({ ...item, end_date: end_date ?? "" })} onValidityChange={report("end_date")} /></Field>
        <Field validationKey={`${uid}-end`}><FieldLabel htmlFor={`${uid}-end`}>Ends</FieldLabel><TimeField id={`${uid}-end`} ambiguousStart="daytime" value={(item.end || null) as WallTime | null} onValueChange={end => onChange({ ...item, end: end ?? "" })} onValidityChange={report("end")} /></Field>
      </div>
      {controlError && <FieldError>{controlError}</FieldError>}
      {issues.map(issue => <FieldError key={issue.target}>{issue.message}</FieldError>)}
      <Field><FieldLabel htmlFor={`${uid}-description`}>Participant description (optional)</FieldLabel><Textarea id={`${uid}-description`} value={item.description} onChange={event => onChange({ ...item, description: event.target.value })} /></Field>
      <Field orientation="horizontal"><FieldContent><FieldLabel htmlFor={`${uid}-override`}>Use a different location</FieldLabel><FieldDescription>Otherwise this item uses the day’s location.</FieldDescription></FieldContent><Switch id={`${uid}-override`} checked={item.location !== null} onCheckedChange={override => onChange({ ...item, location: override ? { ...day.location! } : null })} /></Field>
      {item.location && <LocationEditor prefix={item.key} value={item.location} restricted={restricted} onChange={location => onChange({ ...item, location })} />}
      <Field orientation="horizontal"><FieldContent><FieldLabel htmlFor={`${uid}-check-in`}>Enable check-in</FieldLabel><FieldDescription id={`${uid}-check-in-help`}>{item.attended ? "Attendance has been recorded. This item cannot be removed or have check-in disabled." : "Staff can record attendance for this item. Check-in is optional."}</FieldDescription></FieldContent><Switch id={`${uid}-check-in`} aria-describedby={`${uid}-check-in-help`} checked={item.check_in} disabled={item.attended} onCheckedChange={check_in => onChange({ ...item, check_in })} /></Field>
    </CardContent>
  </Card>;
}

function AgendaDay({ day, index, restricted, onChange, onRemove, showErrors }: {
  day: EventDateDraft; index: number; restricted: boolean; onChange: (day: EventDateDraft) => void; onRemove: () => void; showErrors: boolean;
}) {
  const uid = `date-${day.key}`;
  const [dateError, setDateError] = useState<string | null>(null);
  const [removeItem, setRemoveItem] = useState<string | null>(null);
  return <Card className="min-w-0 gap-4 py-5" role="group" aria-labelledby={`${uid}-heading`}>
    <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-5"><CardTitle id={`${uid}-heading`}>Day {index + 1}</CardTitle><IconButton label={`Remove day ${index + 1}`} disabled={day.items?.some(item => item.attended)} onClick={onRemove}><Trash2 /></IconButton></CardHeader>
    <CardContent className="space-y-5 px-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field validationKey={`${uid}-label`}><FieldLabel htmlFor={`${uid}-label`}>Day label</FieldLabel><Input id={`${uid}-label`} value={day.label} placeholder="E.g. Workshop day" onChange={event => onChange({ ...day, label: event.target.value })} /></Field>
        <Field validationKey={`${uid}-date`}><FieldLabel htmlFor={`${uid}-date`}>Date</FieldLabel><DateField id={`${uid}-date`} value={(day.date || null) as IsoDate | null} onValidityChange={setDateError} onValueChange={date => onChange({ ...day, date: date ?? "", items: day.items?.map(item => ({ ...item, end_date: !item.end_date || item.end_date === day.date ? date ?? "" : item.end_date })) })} />{dateError && <FieldError>{dateError}</FieldError>}</Field>
      </div>
      <FieldSet><FieldLegend>Day location</FieldLegend><LocationEditor prefix={day.key} value={day.location ?? emptyLocation()} restricted={restricted} onChange={location => onChange({ ...day, location })} /></FieldSet>
      <div id={`${uid}-items`} tabIndex={-1} className="space-y-4">
        {!day.items?.length && <FieldDescription>No items yet. Add an item to set this day’s timing.</FieldDescription>}
        {day.items?.map((item, itemIndex) => <AgendaItem key={item.key} day={day} item={item} index={itemIndex} restricted={restricted} showErrors={showErrors} onChange={next => onChange({ ...day, items: day.items!.map(existing => existing.key === item.key ? next : existing) })} onRemove={() => setRemoveItem(item.key)} />)}
        {/* "Add at least one agenda item" is reported against the day's items. */}
        <Field validationKey={`${uid}-items`}><Button type="button" variant="outline" className="w-full border-dashed" onClick={() => onChange({ ...day, items: [...day.items ?? [], emptyAgendaItem(day.date)] })}>+ Add item</Button></Field>
      </div>
    </CardContent>
    <ConfirmDialog open={removeItem !== null} onOpenChange={open => { if (!open) setRemoveItem(null); }} title="Remove this agenda item?" description="The item and its configuration will be removed when you save." confirmLabel="Remove item" onConfirm={() => { onChange({ ...day, items: day.items?.filter(item => item.key !== removeItem) }); setRemoveItem(null); }} />
  </Card>;
}

export function EventAgenda({ value, enabled, onEnabledChange, onChange, disabled, showErrors }: {
  value: EventDateLocationDraft; enabled: boolean; onEnabledChange: (enabled: boolean) => void;
  onChange: (value: EventDateLocationDraft) => void; disabled: boolean; showErrors: boolean;
}) {
  const uid = useId();
  const [removeDay, setRemoveDay] = useState<string | null>(null);
  const update = (next: EventDateLocationDraft) => onChange(agendaProjection(next));
  return <fieldset disabled={disabled} className="min-w-0 space-y-4">
    <legend className="sr-only">Agenda settings</legend>
    <EventSchedule enabled={enabled} onChange={onEnabledChange} />
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Location visibility</CardTitle><CardDescription>Applies to each day and item. Times use Pacific Time (Vancouver).</CardDescription></CardHeader><CardContent className="px-5"><RadioGroup aria-label="Who can see the location" value={value.audience} onValueChange={audience => update({ ...value, audience: audience as EventDateLocationDraft["audience"] })} className="sm:grid-cols-2">{([["everyone", "Everyone"], ["going", "Confirmed attendees only"]] as const).map(([choice, label]) => <FieldLabel key={choice} htmlFor={`${uid}-${choice}`}><Field orientation="horizontal"><RadioGroupItem id={`${uid}-${choice}`} value={choice} /><FieldContent><span>{label}</span><FieldDescription>{choice === "going" ? "Going ticket holders and staff. An accepted offer alone does not grant access." : "Anyone who can see the event."}</FieldDescription></FieldContent></Field></FieldLabel>)}</RadioGroup></CardContent></Card>
    {value.dates.map((day, index) => <AgendaDay key={day.key} day={day} index={index} restricted={value.audience === "going"} showErrors={showErrors} onChange={next => update({ ...value, dates: value.dates.map(existing => existing.key === day.key ? next : existing) })} onRemove={() => setRemoveDay(day.key)} />)}
    {/* Agenda-wide problems ("Add at least one event date.") are reported against the section. */}
    <Field validationKey="builder-agenda"><Button type="button" variant="outline" className="w-full border-dashed" onClick={() => update({ ...value, dates: [...value.dates, emptyAgendaDay()] })}>+ Add day</Button></Field>
    <ConfirmDialog open={removeDay !== null} onOpenChange={open => { if (!open) setRemoveDay(null); }} title="Remove this agenda day?" description="The day and all its items will be removed when you save." confirmLabel="Remove day" onConfirm={() => { update({ ...value, dates: value.dates.filter(day => day.key !== removeDay) }); setRemoveDay(null); }} />
  </fieldset>;
}
