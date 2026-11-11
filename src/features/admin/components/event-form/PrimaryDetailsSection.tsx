"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventMarketing } from "./EventMarketing";
import { type EventFormState } from "./event-form-schema";

interface Props {
  formState: EventFormState;
  onFieldChange: <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => void;
  urlLocked?: boolean;
  showConfigurationErrors?: boolean;
}
export function PrimaryDetailsSection({ formState: state, onFieldChange: change, urlLocked = false, showConfigurationErrors = false }: Props) {

  return <FieldGroup data-slot="card" className="gap-4 rounded-xl border border-border bg-card p-5">
    <>
      <Field validationKey="event-name"><FieldLabel htmlFor="event-name">Event name</FieldLabel><Input id="event-name" value={state.name} placeholder="E.g. Design Sprint 2026" onChange={event => change("name", event.target.value)} /></Field>
      <Field><FieldLabel className="text-small font-medium" htmlFor="event-type">Event type</FieldLabel><Select value={state.event_type} onValueChange={value => change("event_type", value as EventFormState["event_type"])}><SelectTrigger id="event-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regular">Regular</SelectItem><SelectItem value="flagship">Flagship</SelectItem></SelectContent></Select></Field>
      <EventMarketing showErrors={showConfigurationErrors} state={state} urlLocked={urlLocked} onChange={change} />
    </>

  </FieldGroup>;
}
