"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DateField, DateTimeFieldPair, TimeField } from "@/components/ui/date-time-field";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { IsoDate, WallTime } from "@/lib/date-input";
import { applicationTimingProblem, type EventFormState } from "./event-form-schema";

const moments = [
  ["decisions_release_at", "Release decisions on"],
  ["confirmation_deadline", "Confirm by"],
] as const;

export function ApplicationTiming({ state, showErrors, onChange }: {
  state: EventFormState;
  showErrors: boolean;
  onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const problem = showErrors ? applicationTimingProblem(state) : null;
  return <Card className="gap-4 py-5">
    <CardHeader className="px-5"><CardTitle>Application timing</CardTitle><CardDescription>Save the decision release and common confirmation deadline. Times are in Pacific Time (Vancouver).</CardDescription></CardHeader>
    <CardContent className="space-y-4 px-5">
      <FieldGroup className="grid gap-4 @min-[36rem]/field-group:grid-cols-2">
        {moments.map(([key, label]) => {
          const [date = "", time = ""] = state[key].split("T");
          const dateError = errors[key];
          const timeError = errors[`${key}-time`];
          const errorId = `${key}-error`;
          const update = (nextDate: string, nextTime: string) => onChange(key, !nextDate && !nextTime ? "" : `${nextDate}T${nextTime}`);
          return <Field key={key} data-invalid={!!(dateError || timeError || problem)}>
            <FieldLabel htmlFor={`${key}-date`}>{label} (optional)</FieldLabel>
            <DateTimeFieldPair timeWidth="wide" date={<DateField id={`${key}-date`} value={(date || null) as IsoDate | null} aria-describedby={errorId} onValueChange={next => update(next ?? "", time)} onValidityChange={error => setErrors(current => ({ ...current, [key]: error }))} />} time={<TimeField id={`${key}-time`} aria-label={`${label} time`} aria-describedby={errorId} ambiguousStart="daytime" value={(time || null) as WallTime | null} onValueChange={next => update(date, next ?? "")} onValidityChange={error => setErrors(current => ({ ...current, [`${key}-time`]: error }))} />} />
            <FieldError id={errorId}>{dateError ?? timeError ?? problem}</FieldError>
            {state[key] && <Button type="button" variant="ghost" className="min-h-11 w-fit sm:min-h-10" onClick={() => onChange(key, "")}>Clear {label.toLowerCase()}</Button>}
          </Field>;
        })}
      </FieldGroup>
    </CardContent>
  </Card>;
}
