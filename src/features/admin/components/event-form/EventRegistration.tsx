"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegistrationWindowCard } from "./RegistrationTimes";
import { formatDateInput, formatTimeInput, type IsoDate, type WallTime } from "@/lib/date-input";
import type { EventFormState } from "./event-form-schema";
import type { ReminderSchedule } from "@/lib/supabase-helpers/event-reminders";

const REMINDER_OPTIONS: [ReminderSchedule, string][] = [
  ["off", "Off"],
  ["1d", "1 day before"],
  ["2h", "2 hours before"],
  ["both", "1 day and 2 hours before"],
];

export function EventRegistration({ state, disabled, info, onChange }: { state: EventFormState; disabled: boolean; info: { seats: number }; onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void }) {
  const invalidCapacity = state.max_capacity !== "" && (!/^\d+$/.test(state.max_capacity) || Number(state.max_capacity) < Math.max(0, info.seats));
  return <fieldset disabled={disabled} className="space-y-4 min-w-0"><legend className="sr-only">Registration settings</legend>
    {!state.requires_application && <RegistrationWindowCard registration_opens_at={state.registration_opens_at} registration_closes_at={state.registration_closes_at} applications={false} onFieldChange={onChange} />}
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Capacity</CardTitle><CardDescription className="text-body">When every spot is taken, the event shows &quot;Full&quot; until a spot opens.</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="px-5"><Field validationKey="event-capacity" data-invalid={invalidCapacity}><FieldLabel htmlFor="event-capacity">Capacity</FieldLabel><Input id="event-capacity" type="number" min={Math.max(0, info.seats)} step="1" placeholder="E.g. 120" value={state.max_capacity} onChange={event => onChange("max_capacity", event.target.value)} />{invalidCapacity && <FieldError>Capacity must be a whole number of at least {Math.max(0, info.seats)}.</FieldError>}{info.seats > 0 && <FieldDescription>{info.seats} committed seats, including tickets and held offers. Capacity can go up, or down to {info.seats}.</FieldDescription>}</Field></CardContent></Card>
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Reminder email</CardTitle><CardDescription className="text-body">Ticket holders get the time, the place and their ticket by email before the event starts.</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="px-5"><Field validationKey="reminder-schedule"><FieldLabel htmlFor="reminder-schedule">Reminder email</FieldLabel><Select value={state.reminder_schedule} disabled={disabled} onValueChange={value => onChange("reminder_schedule", value as ReminderSchedule)}><SelectTrigger id="reminder-schedule" className="w-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{REMINDER_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field></CardContent></Card>
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Check-in</CardTitle><CardDescription className="text-body">Set automatically from agenda items. Each date is open for check-in for as long as it runs.</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="space-y-3 px-5">
      {state.date_location?.dates.filter(row => row.date && row.start && row.end).map(row => <div key={row.key} className="rounded-lg border border-border-subtle bg-muted p-4"><p className="font-medium">{formatDateInput(row.date as IsoDate)}{row.label ? ` · ${row.label}` : ""}</p><p className="text-small text-muted-foreground">Check-in open {formatTimeInput(row.start as WallTime)}–{formatTimeInput(row.end as WallTime)} PT</p></div>)}
    </CardContent></Card>
  </fieldset>;
}
