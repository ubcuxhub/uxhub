"use client";

import { useState } from "react";
import { DateField, DateTimeFieldPair, TimeField } from "@/components/ui/date-time-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { momentEndsTooEarly, pacificMomentProblem } from "../../lib/pacific-moment";
import { windowLabels } from "../../lib/event-registration-window";
import type { IsoDate, WallTime } from "@/lib/date-input";

interface RegistrationTimesState {
  registration_opens_at: string;
  registration_closes_at: string;
}

type OnFieldChange = <K extends keyof RegistrationTimesState>(key: K, value: RegistrationTimesState[K]) => void;

function RegistrationMoment({ id, label, value, after, onChange }: { id: string; label: string; value: string; after?: string; onChange: (value: string) => void }) {
  const [date = "", time = ""] = value.split("T");
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const update = (date: string, time: string) => onChange(!date && !time ? "" : `${date}T${time}`);
  const clockError = date && time ? pacificMomentProblem(value) : null;
  const error = dateError ?? timeError ?? clockError;
  return <Field data-invalid={!!error}>
    <FieldLabel htmlFor={`${id}-date`}>{label}</FieldLabel>
    <DateTimeFieldPair timeWidth="wide" date={<DateField id={`${id}-date`} value={(date || null) as IsoDate | null} onValueChange={next => update(next ?? "", time)} onValidityChange={setDateError} />} time={<TimeField id={`${id}-time`} aria-label={`${label} time`} ambiguousStart="daytime" value={(time || null) as WallTime | null} after={(after || undefined) as WallTime | undefined} onValueChange={next => update(date, next ?? "")} onValidityChange={setTimeError} />} />
    {error && <FieldError>{error}</FieldError>}
    {value && <Button type="button" variant="ghost" className="w-fit" onClick={() => onChange("")}>Clear {label.toLowerCase()}</Button>}
  </Field>;
}

export function RegistrationTimes({ registration_opens_at: opens, registration_closes_at: closes, applications = false, onFieldChange }: RegistrationTimesState & { applications?: boolean; onFieldChange: OnFieldChange }) {
  const labels = windowLabels(applications);
  const sameDate = !!opens && opens.split("T")[0] === closes.split("T")[0];
  return <FieldGroup className="grid gap-4 @min-[36rem]/field-group:grid-cols-2">
    <RegistrationMoment id="registration_opens_at" label={labels.opens} value={opens} onChange={value => onFieldChange("registration_opens_at", value)} />
    <RegistrationMoment id="registration_closes_at" label={labels.closes} value={closes} after={sameDate ? opens.split("T")[1] : undefined} onChange={value => onFieldChange("registration_closes_at", value)} />
    {momentEndsTooEarly(opens, closes) && <FieldError className="@min-[36rem]/field-group:col-span-2">{labels.reversed}</FieldError>}
  </FieldGroup>;
}

/**
 * The window card: when registration opens and closes or, on an event that
 * takes applications, when applying does.
 */
export function RegistrationWindowCard({ applications, onFieldChange, ...times }: RegistrationTimesState & { applications: boolean; onFieldChange: OnFieldChange }) {
  return <Card className="gap-4 py-5">
    <CardHeader className="px-5">
      <CardTitle>{windowLabels(applications).window}</CardTitle>
      <CardDescription className="text-body">
        {applications
          ? "When members can apply. Closing only stops new applications: decisions stand, and accepted applicants register until their own deadline. Times are in Pacific Time (Vancouver)."
          : "Publication and registration are separate. Set when registration opens and closes. Times are in Pacific Time (Vancouver)."}
      </CardDescription>
    </CardHeader>
    <Separator className="mx-5 w-auto" />
    <CardContent className="px-5"><RegistrationTimes {...times} applications={applications} onFieldChange={onFieldChange} /></CardContent>
  </Card>;
}
