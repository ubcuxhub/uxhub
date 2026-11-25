"use client";

import { LockKeyhole } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

/**
 * The builder's Applications switch: whether members apply and wait for a
 * decision before they can register. Locked once anyone has registered or
 * paid, since their status depends on how they signed up.
 */
export function ApplicationsToggle({ enabled, locked, onChange }: { enabled: boolean; locked: boolean; onChange: (enabled: boolean) => void }) {
  return <Card className="gap-4 py-5">
    <CardContent className="space-y-4 px-5">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="requires_application">Members apply before they register</FieldLabel>
          <FieldDescription id="requires_application-description">
            {enabled
              ? "UX Hub execs review each application and accept, waitlist or reject it. Applications need at least one question."
              : "Off: anyone eligible can register until the event is full."}
          </FieldDescription>
        </FieldContent>
        <Switch id="requires_application" aria-describedby="requires_application-description" checked={enabled} disabled={locked} onCheckedChange={onChange} />
      </Field>
      {locked && <p className="flex items-start gap-2 rounded-lg bg-muted p-4 text-small"><LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />Locked because registrations or payments exist. Their statuses depend on how they signed up.</p>}
    </CardContent>
  </Card>;
}
