"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateField, DateTimeFieldPair, TimeField } from "@/components/ui/date-time-field";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedToggle, SegmentedToggleItem } from "@/components/ui/segmented-toggle";
import type { IsoDate, WallTime } from "@/lib/date-input";
import type { EventTeamSettingsInfo } from "@/lib/supabase-helpers/teams";
import { teamSettingsProblem, type EventFormState } from "./event-form-schema";

export function EventTeams({ state, info, showErrors, onChange }: {
  state: EventFormState;
  info: EventTeamSettingsInfo;
  showErrors: boolean;
  onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;
}) {
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const problem = showErrors ? teamSettingsProblem(state) : null;
  const [date = "", time = ""] = state.team_deadline.split("T");
  const updateDeadline = (nextDate: string, nextTime: string) => onChange("team_deadline", !nextDate && !nextTime ? "" : `${nextDate}T${nextTime}`);
  const sizeFloor = info.largestTeam > 0 && state.max_team_size !== "" && Number(state.max_team_size) < info.largestTeam;
  return <div className="space-y-4 rounded-xl border border-border bg-card p-5">
    <Field orientation="horizontal"><FieldContent><FieldLabel id="team-event-label">Is this a team event?</FieldLabel></FieldContent>
      <SegmentedToggle aria-label="Is this a team event?" value={state.teams_enabled ? "yes" : "no"} onValueChange={value => onChange("teams_enabled", value === "yes")} aria-describedby={info.teamCount ? "team-settings-lock" : undefined} className="sm:h-10">
        <SegmentedToggleItem value="no" disabled={info.teamCount > 0}>No</SegmentedToggleItem><SegmentedToggleItem value="yes">Yes</SegmentedToggleItem>
      </SegmentedToggle>
    </Field>
    {info.teamCount > 0 && <p id="team-settings-lock" className="text-small text-muted-foreground">Teams cannot be turned off because {info.teamCount} {info.teamCount === 1 ? "team exists" : "teams exist"}. The largest team has {info.largestTeam} {info.largestTeam === 1 ? "member" : "members"}.</p>}
    {state.teams_enabled && <>
      <FieldGroup className="grid gap-4 @min-[30rem]/field-group:grid-cols-2">
        {([["min_team_size", "Minimum team size"], ["max_team_size", "Maximum team size"]] as const).map(([key, label]) => <Field key={key} data-invalid={!!problem || (key === "max_team_size" && sizeFloor)}>
          <FieldLabel htmlFor={key}>{label} (optional)</FieldLabel>
          <Input id={key} type="number" min={key === "max_team_size" ? Math.max(1, info.largestTeam) : 1} step="1" aria-describedby="team-settings-error" value={state[key]} onChange={event => onChange(key, event.target.value)} placeholder="No limit" className="min-h-11 sm:min-h-10" />
          {key === "max_team_size" && sizeFloor && <FieldError>Maximum team size cannot be below {info.largestTeam}, the largest existing team.</FieldError>}
        </Field>)}
      </FieldGroup>
      <Field data-invalid={!!(dateError || timeError || problem)}>
        <FieldLabel htmlFor="team-deadline-date">Team deadline (optional)</FieldLabel>
        <DateTimeFieldPair timeWidth="wide" date={<DateField id="team-deadline-date" value={(date || null) as IsoDate | null} onValueChange={value => updateDeadline(value ?? "", time)} onValidityChange={setDateError} aria-describedby="team-deadline-description team-settings-error" />} time={<TimeField id="team-deadline-time" aria-label="Team deadline time" ambiguousStart="daytime" value={(time || null) as WallTime | null} onValueChange={value => updateDeadline(date, value ?? "")} onValidityChange={setTimeError} aria-describedby="team-deadline-description team-settings-error" />} />
        <FieldDescription id="team-deadline-description">Pacific Time (Vancouver). Leave blank for no deadline. Teams lock at the deadline.</FieldDescription>
        {state.team_deadline && <Button type="button" variant="ghost" className="min-h-11 w-fit sm:min-h-10" onClick={() => updateDeadline("", "")}>Clear team deadline</Button>}
      </Field>
    </>}
    {(dateError || timeError || problem) && <FieldError id="team-settings-error" role="alert">{dateError ?? timeError ?? problem}</FieldError>}
  </div>;
}
