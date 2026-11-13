"use client";

import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

export function EventSchedule({ enabled, onChange }: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="event-agenda-enabled">Show a schedule on the event page</FieldLabel>
          <FieldDescription id="event-agenda-description">Off: the event page has no agenda. Turn it on to show the saved agenda.</FieldDescription>
        </FieldContent>
        <Switch id="event-agenda-enabled" aria-describedby="event-agenda-description" checked={enabled} onCheckedChange={onChange} />
      </Field>
    </div>
  );
}
