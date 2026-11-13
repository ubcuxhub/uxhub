"use client";

import { useState } from "react";
import { DateField, DateTimeFieldPair, TimeField } from "@/components/ui/date-time-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { strictPacificTimestamp } from "@/lib/date";
import type { IsoDate, WallTime } from "@/lib/date-input";

interface RegistrationTimesState {
  registration_opens_at: string;
  registration_closes_at: string;
}

function RegistrationMoment({ id, label, value, after, onChange }: { id: string; label: string; value: string; after?: string; onChange: (value: string) => void }) {
  const [date = "", time = ""] = value.split("T");
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const update = (date: string, time: string) => onChange(!date && !time ? "" : `${date}T${time}`);
  const clockError = date && time && !strictPacificTimestamp(value) ? "Use an unambiguous, valid Pacific date and time." : null;
  const error = dateError ?? timeError ?? clockError;
  return <Field data-invalid={!!error}>
    <FieldLabel htmlFor={`${id}-date`}>{label}</FieldLabel>
    <DateTimeFieldPair timeWidth="wide" date={<DateField id={`${id}-date`} value={(date || null) as IsoDate | null} onValueChange={next => update(next ?? "", time)} onValidityChange={setDateError} />} time={<TimeField id={`${id}-time`} aria-label={`${label} time`} ambiguousStart="daytime" value={(time || null) as WallTime | null} after={(after || undefined) as WallTime | undefined} onValueChange={next => update(date, next ?? "")} onValidityChange={setTimeError} />} />
    {error && <FieldError>{error}</FieldError>}
    {value && <Button type="button" variant="ghost" className="w-fit" onClick={() => onChange("")}>Clear {label.toLowerCase()}</Button>}
  </Field>;
}

export function RegistrationTimes({ registration_opens_at: opens, registration_closes_at: closes, onFieldChange }: RegistrationTimesState & { onFieldChange: <K extends keyof RegistrationTimesState>(key: K, value: RegistrationTimesState[K]) => void }) {
  const sameDate = !!opens && opens.split("T")[0] === closes.split("T")[0];
  return <FieldGroup className="grid gap-4 @min-[36rem]/field-group:grid-cols-2">
    <RegistrationMoment id="registration_opens_at" label="Registration Opens" value={opens} onChange={value => onFieldChange("registration_opens_at", value)} />
    <RegistrationMoment id="registration_closes_at" label="Registration Closes" value={closes} after={sameDate ? opens.split("T")[1] : undefined} onChange={value => onFieldChange("registration_closes_at", value)} />
    {opens && closes && opens >= closes && <FieldError className="@min-[36rem]/field-group:col-span-2">Registration end time must be after the start time.</FieldError>}
  </FieldGroup>;
}
