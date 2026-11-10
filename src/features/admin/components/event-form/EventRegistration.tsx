"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldDescription, FieldError, FieldContent } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RegistrationTimes } from "./RegistrationTimes";
import { formatDateInput, formatTimeInput, type IsoDate, type WallTime } from "@/lib/date-input";
import type { EventFormState } from "./event-form-schema";

export function EventRegistration({ state, disabled, info, onChange }: { state: EventFormState; disabled: boolean; info: { locked: boolean; seats: number }; onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void }) {
  const invalidCapacity = state.max_capacity !== "" && (!/^\d+$/.test(state.max_capacity) || Number(state.max_capacity) < Math.max(0, info.seats));
  return <fieldset disabled={disabled} className="space-y-4 min-w-0"><legend className="sr-only">Registration settings</legend>
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>How people register</CardTitle><CardDescription className="text-body">This decides which statuses members can see. Applications need at least one question.</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="px-5">
      {info.locked ? <p className="rounded-lg bg-muted p-4">{state.requires_application ? "Application" : "Open RSVP"} · Locked because registrations or payments exist. Their statuses depend on how they signed up.</p> : <RadioGroup className="sm:grid-cols-2" value={state.requires_application ? "application" : "rsvp"} onValueChange={value => onChange("requires_application", value === "application")} aria-label="How people register">
        {[["rsvp", "Open RSVP", "Anyone eligible can RSVP until the event is full."], ["application", "Application", "Members apply, organizers review and accept."]].map(([value, title, description]) => <FieldLabel key={value}><Field orientation="horizontal"><RadioGroupItem value={value} /><FieldContent><span>{title}</span><FieldDescription>{description}</FieldDescription></FieldContent></Field></FieldLabel>)}
      </RadioGroup>}
    </CardContent></Card>
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Registration window</CardTitle><CardDescription className="text-body">Publication and registration are separate. Set when registration opens and closes. Times are in Pacific Time (Vancouver).</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="px-5"><RegistrationTimes registration_opens_at={state.registration_opens_at} registration_closes_at={state.registration_closes_at} onFieldChange={onChange} /></CardContent></Card>
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Capacity</CardTitle><CardDescription className="text-body">When every spot is taken, the event shows Full until a spot opens.</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="px-5"><Field data-invalid={invalidCapacity}><FieldLabel htmlFor="event-capacity">Capacity</FieldLabel><Input id="event-capacity" type="number" min={Math.max(0, info.seats)} step="1" placeholder="E.g. 120" value={state.max_capacity} onChange={event => onChange("max_capacity", event.target.value)} />{invalidCapacity && <FieldError>Capacity must be a whole number of at least {Math.max(0, info.seats)}.</FieldError>}{info.seats > 0 && <FieldDescription>{info.seats} committed seats, including tickets and held offers. Capacity can go up, or down to {info.seats}.</FieldDescription>}</Field></CardContent></Card>
    <Card className="gap-4 py-5"><CardHeader className="px-5"><CardTitle>Check-in</CardTitle><CardDescription className="text-body">Set automatically from Date and location. Each date is open for check-in for as long as it runs.</CardDescription></CardHeader><Separator className="mx-5 w-auto" /><CardContent className="space-y-3 px-5">
      {state.date_location?.dates.filter(row => row.date && row.start && row.end).map(row => <div key={row.key} className="rounded-lg border border-border-subtle bg-muted p-4"><p className="font-medium">{formatDateInput(row.date as IsoDate)}{row.label ? ` · ${row.label}` : ""}</p><p className="text-small text-muted-foreground">Check-in open {formatTimeInput(row.start as WallTime)}–{formatTimeInput(row.end as WallTime)} PT</p></div>)}
    </CardContent></Card>
  </fieldset>;
}
