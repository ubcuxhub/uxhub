"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventMarketing } from "./EventMarketing";
import { PublicationPicker } from "./PublicationPicker";
import { type EventFormState } from "./event-form-schema";

interface Props {
  formState: EventFormState;
  isSubmitting: boolean;
  onFieldChange: <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => void;
  urlLocked?: boolean;
  showConfigurationErrors?: boolean;
  section?: "basics" | "publication";
}
export function PrimaryDetailsSection({ formState: state, isSubmitting, onFieldChange: change, urlLocked = false, showConfigurationErrors = false, section = "basics" }: Props) {

  return <FieldGroup className="gap-4 rounded-xl border border-border bg-card p-5">
    {section === "basics" && <>
      <Field><FieldLabel htmlFor="event-name">Event name</FieldLabel><Input id="event-name" value={state.name} placeholder="E.g. Design Sprint 2026" onChange={event => change("name", event.target.value)} /></Field>
      <Field><FieldLabel className="text-small font-medium" htmlFor="event-type">Event type</FieldLabel><Select value={state.event_type} onValueChange={value => change("event_type", value as EventFormState["event_type"])}><SelectTrigger id="event-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regular">Regular</SelectItem><SelectItem value="flagship">Flagship</SelectItem></SelectContent></Select></Field>
      <EventMarketing showErrors={showConfigurationErrors} state={state} urlLocked={urlLocked} onChange={change} />
    </>}
    {section === "publication" && <>
      <Field><FieldLabel className="text-small font-medium" htmlFor="event-status">Event status</FieldLabel><Select value={state.status} onValueChange={value => change("status", value as EventFormState["status"])}><SelectTrigger id="event-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem></SelectContent></Select></Field>
      <PublicationPicker value={state.publish_at} onChange={value => change("publish_at", value)} disabled={isSubmitting || state.status !== "draft"} />
    </>}
  </FieldGroup>;
}
