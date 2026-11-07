"use client";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PublicationPicker } from "./PublicationPicker";
import { EventSchedule } from "./EventSchedule";
import { RegistrationTimes } from "./RegistrationTimes";
import { isFreePricing, type EventFormState } from "./event-form-schema";

interface Props {
  formState: EventFormState;
  isSubmitting: boolean;
  onFieldChange: <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => void;
  section?: "basics" | "dates" | "registration" | "publication";
}
export function PrimaryDetailsSection({ formState: state, isSubmitting, onFieldChange: change, section = "basics" }: Props) {
  const field = (key: "name" | "max_capacity" | "regular_price" | "member_price" | "location_building" | "location_room" | "location_address_url", label: string, type = "text") => <Field><FieldLabel className="text-small font-medium" htmlFor={`event-${key}`}>{label}</FieldLabel><Input id={`event-${key}`} type={type} value={state[key]} placeholder={key === "name" ? "E.g. Design Sprint 2026" : undefined} min={type === "number" ? 0 : undefined} onChange={e => change(key, e.target.value)} /></Field>;
  return <FieldGroup className="gap-4 rounded-xl border border-border bg-card p-5">
    {section === "basics" && <>
      {field("name", "Event name")}
      <Field><FieldLabel className="text-small font-medium" htmlFor="event-type">Event type</FieldLabel><Select value={state.event_type} onValueChange={value => change("event_type", value as EventFormState["event_type"])}><SelectTrigger id="event-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regular">Regular</SelectItem><SelectItem value="flagship">Flagship</SelectItem></SelectContent></Select></Field>
      <div className="flex items-center gap-3"><Switch id="event-free" checked={isFreePricing(state.regular_price, state.member_price)} onCheckedChange={checked => { change("regular_price", checked ? "0" : ""); change("member_price", checked ? "0" : ""); }} /><FieldLabel className="text-small font-medium" htmlFor="event-free">Free</FieldLabel></div>
      <div className="grid gap-4 sm:grid-cols-2">{field("regular_price", "Non-member price (CAD)", "number")}{field("member_price", "Member price (CAD)", "number")}</div>
    </>}
    {section === "dates" && <>
      <EventSchedule starts_at={state.starts_at} ends_at={state.ends_at} onFieldChange={change} />
      <div className="grid gap-4 sm:grid-cols-2">{field("location_building", "Building")}{field("location_room", "Room")}</div>
      {field("location_address_url", "Map link", "url")}
    </>}
    {section === "registration" && <><RegistrationTimes registration_opens_at={state.registration_opens_at} registration_closes_at={state.registration_closes_at} onFieldChange={change} />{field("max_capacity", "Capacity", "number")}</>}
    {section === "publication" && <>
      <Field><FieldLabel className="text-small font-medium" htmlFor="event-status">Event status</FieldLabel><Select value={state.status} onValueChange={value => change("status", value as EventFormState["status"])}><SelectTrigger id="event-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem></SelectContent></Select></Field>
      <PublicationPicker value={state.publish_at} onChange={value => change("publish_at", value)} disabled={isSubmitting || state.status !== "draft"} />
    </>}
  </FieldGroup>;
}
