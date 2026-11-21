"use client";

import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { SegmentedToggle, SegmentedToggleItem } from "@/components/ui/segmented-toggle";
import type { LocationDraft } from "@/lib/location";

export function LocationEditor({ value, onChange, restricted, prefix }: { prefix: string; value: LocationDraft; onChange: (value: LocationDraft) => void; restricted: boolean }) {
  const uid = `location-${prefix}`;
  const field = (key: Exclude<keyof LocationDraft, "type">, label: string, placeholder: string, type = "text") => <Field key={key} validationKey={`${uid}-${key}`}>
    <FieldLabel htmlFor={`${uid}-${key}`}>{label}</FieldLabel>
    <Input id={`${uid}-${key}`} type={type} value={value[key]} placeholder={placeholder} onChange={event => onChange({ ...value, [key]: event.target.value })} />
    {key === "public_summary" && <FieldDescription>Everyone who can see the event can see this summary. Keep exact private details out of it.</FieldDescription>}
  </Field>;
  return <div className="space-y-4">
    <SegmentedToggle aria-label="Location type" value={value.type} onValueChange={type => onChange({ ...value, type: type as LocationDraft["type"] })}>
      <SegmentedToggleItem value="in_person">In person</SegmentedToggleItem><SegmentedToggleItem value="online">Online</SegmentedToggleItem><SegmentedToggleItem value="hybrid">Hybrid</SegmentedToggleItem>
    </SegmentedToggle>
    {value.type !== "online" && <div className="grid gap-4 sm:grid-cols-2">
      {field("building", "Building", "E.g. AMS Student Nest")}{field("room", "Room (optional)", "E.g. Room 2306")}
      {field("address", "Street address", "E.g. 6133 University Blvd, Vancouver")}{field("map_url", "Map link (optional)", "Paste a map link", "url")}
    </div>}
    {value.type !== "in_person" && <div className="grid gap-4 sm:grid-cols-2">
      {field("meeting_url", "Meeting link", "https://", "url")}{field("meeting_id", "Meeting ID (optional)", "E.g. 123 456 789")}{field("meeting_passcode", "Passcode (optional)", "Meeting passcode")}
    </div>}
    {restricted && field("public_summary", "Public location summary", "E.g. UBC Vancouver; exact room shared with confirmed attendees")}
  </div>;
}
