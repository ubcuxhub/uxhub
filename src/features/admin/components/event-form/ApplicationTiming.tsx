"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DateField, DateTimeFieldPair, TimeField } from "@/components/ui/date-time-field";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { formatTimestamp } from "@/lib/date";
import type { IsoDate, WallTime } from "@/lib/date-input";
import { applicationTimingProblem, type EventFormState } from "./event-form-schema";

type MomentKey = "decisions_release_at" | "confirmation_deadline";

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/**
 * Release decisions on (behind a switch) and Confirm by. The switch can't hold
 * decisions back once applicants can see them, which the database refuses
 * too (`guard_application_release_time`), and asks before a save would show
 * decisions that are still hidden.
 */
export function ApplicationTiming({ state, showErrors, onChange, savedReleaseAt = null, decidedApplications = 0 }: {
  state: EventFormState;
  showErrors: boolean;
  onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;
  /** The saved "Release decisions on", null when none is. */
  savedReleaseAt?: string | null;
  /** Applications with a decision, whether or not applicants can see it yet. */
  decidedApplications?: number;
}) {
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [now] = useState(() => Date.now());
  const [switchedOn, setSwitchedOn] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const stashedRelease = useRef("");
  const problem = showErrors ? applicationTimingProblem(state) : null;

  const saved = savedReleaseAt ? Date.parse(savedReleaseAt) : null;
  const decisionsVisible = saved !== null ? saved <= now : decidedApplications > 0;
  const decisionsHidden = saved !== null && saved > now && decidedApplications > 0;
  const holding = switchedOn || state.decisions_release_at !== "";

  const clearErrors = (key: MomentKey) => setErrors(current => ({ ...current, [key]: null, [`${key}-time`]: null }));
  const turnOff = () => {
    stashedRelease.current = state.decisions_release_at;
    setSwitchedOn(false);
    setConfirmingOff(false);
    clearErrors("decisions_release_at");
    onChange("decisions_release_at", "");
  };
  const onHoldingChange = (next: boolean) => {
    if (next) {
      setSwitchedOn(true);
      if (stashedRelease.current) onChange("decisions_release_at", stashedRelease.current);
    } else if (decisionsHidden) {
      setConfirmingOff(true);
    } else {
      turnOff();
    }
  };

  const moment = (key: MomentKey, label: string, hint: string, optional: boolean) => {
    const [date = "", time = ""] = state[key].split("T");
    const dateError = errors[key];
    const timeError = errors[`${key}-time`];
    const errorId = `${key}-error`;
    const update = (nextDate: string, nextTime: string) => onChange(key, !nextDate && !nextTime ? "" : `${nextDate}T${nextTime}`);
    return <Field data-invalid={!!(dateError || timeError || problem)}>
      <FieldLabel htmlFor={`${key}-date`}>{label}{optional ? " (optional)" : ""}</FieldLabel>
      <DateTimeFieldPair timeWidth="wide" date={<DateField id={`${key}-date`} value={(date || null) as IsoDate | null} aria-describedby={errorId} onValueChange={next => update(next ?? "", time)} onValidityChange={error => setErrors(current => ({ ...current, [key]: error }))} />} time={<TimeField id={`${key}-time`} aria-label={`${label} time`} aria-describedby={errorId} ambiguousStart="daytime" value={(time || null) as WallTime | null} onValueChange={next => update(date, next ?? "")} onValidityChange={error => setErrors(current => ({ ...current, [`${key}-time`]: error }))} />} />
      <FieldDescription>{hint}</FieldDescription>
      <FieldError id={errorId}>{dateError ?? timeError ?? problem}</FieldError>
      {optional && state[key] && <Button type="button" variant="ghost" className="min-h-11 w-fit sm:min-h-10" onClick={() => onChange(key, "")}>Clear {label.toLowerCase()}</Button>}
    </Field>;
  };

  return <Card className="gap-4 py-5">
    <CardHeader className="px-5"><CardTitle>Application timing</CardTitle><CardDescription>When applicants see decisions, and the common confirmation deadline. Times are in Pacific Time (Vancouver).</CardDescription></CardHeader>
    <CardContent className="space-y-4 px-5">
      <FieldGroup className="grid gap-4 @min-[36rem]/field-group:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="decisions-release-held">Release decisions at a set time</FieldLabel>
              <FieldDescription id="decisions-release-held-description">
                {decisionsVisible
                  ? "Applicants can already see decisions, so they can’t be held back now."
                  : holding
                    ? "Applicants don’t see any decision until the release."
                    : "Off: applicants see each decision as soon as it’s made."}
              </FieldDescription>
            </FieldContent>
            <Switch id="decisions-release-held" aria-describedby="decisions-release-held-description" checked={holding} disabled={decisionsVisible} onCheckedChange={onHoldingChange} />
          </Field>
          {holding && moment("decisions_release_at", "Release decisions on", "Applicants don’t see a decision until this time.", false)}
        </div>
        {moment("confirmation_deadline", "Confirm by", "New offers default to this deadline for accepting.", true)}
      </FieldGroup>
    </CardContent>
    <ConfirmDialog
      open={confirmingOff}
      onOpenChange={setConfirmingOff}
      title="Show decisions when you save?"
      description={`${plural(decidedApplications, "decision")} ${decidedApplications === 1 ? "is" : "are"} hidden until ${formatTimestamp(savedReleaseAt)}. Without a release time, applicants see ${decidedApplications === 1 ? "it" : "them"} as soon as you save the event.`}
      cancelLabel="Keep the release time"
      confirmLabel="Turn off"
      confirmVariant="default"
      onConfirm={turnOff}
    />
  </Card>;
}
