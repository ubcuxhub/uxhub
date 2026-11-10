"use client";

import { useId, useState } from "react";

import { EventDateLocation } from "@/features/admin/components/event-form/EventDateLocation";
import { EventRegistration } from "@/features/admin/components/event-form/EventRegistration";
import { defaultFormState } from "@/features/admin/components/event-form/event-form-schema";
import { emptyLocation, type EventDateLocationDraft } from "@/features/admin/lib/event-date-location";

import { ImageUpload } from "@/components/shared/ImageUpload";
import { SectionNavigator } from "@/components/shared/SectionNavigator";
import { Ticket } from "@/components/shared/Ticket";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColourPicker } from "@/components/ui/colour-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { DateField, TimeField } from "@/components/ui/date-time-field";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { timeOptions, type IsoDate, type WallTime } from "@/lib/date-input";

import { ART_SKY, BUILDER_SECTIONS, DATE, JUDGES, QR_TOKEN, TODAY, VENUES } from "../_fixtures";
import { Panel } from "./frame";
import { QrCode } from "./qr";
import type { Components } from "./types";

function Basics() {
  const uid = useId();
  const [name, setName] = useState("UXathon 2027");
  const [thumbnail, setThumbnail] = useState(ART_SKY);
  const missing = !name.trim();
  return (
    <Panel>
      <CardHeader>
        <span className="text-label tabular-nums text-muted-foreground">01/06</span>
        <CardTitle className="text-h3">Basics</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field data-invalid={missing ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-name`}>Event name</FieldLabel>
          <Input
            id={`${uid}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={missing ? true : undefined}
            aria-describedby={missing ? `${uid}-name-error` : undefined}
          />
          {missing ? (
            <FieldError id={`${uid}-name-error`}>Give the event a name.</FieldError>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${uid}-about`}>About the event</FieldLabel>
          <Textarea
            id={`${uid}-about`}
            rows={3}
            maxLength={500}
            showCount
            defaultValue="A weekend to take a real brief from research to a clickable prototype, with mentors in the room and judges at the end."
          />
        </Field>
        <ImageUpload
          label="Thumbnail"
          requirements={{ square: true, minWidth: 600, minHeight: 600 }}
          value={thumbnail}
          onChange={setThumbnail}
        />
      </CardContent>
    </Panel>
  );
}

function Schedule() {
  const uid = useId();
  const [date, setDate] = useState<IsoDate | null>(DATE);
  const [start, setStart] = useState<WallTime | null>("09:00");
  const [end, setEnd] = useState<WallTime | null>("08:30");
  const [endError, setEndError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState(120);
  const [applications, setApplications] = useState(true);

  return (
    <Panel>
      <CardHeader>
        <span className="text-label tabular-nums text-muted-foreground">03/06</span>
        <CardTitle className="text-h3">Date and capacity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor={`${uid}-date`}>Date</FieldLabel>
          <DateField
            id={`${uid}-date`}
            value={date}
            onValueChange={setDate}
            today={TODAY}
            min={TODAY}
          />
        </Field>
        <div className="grid grid-cols-2 items-start gap-3">
          <Field>
            <FieldLabel htmlFor={`${uid}-start`}>Starts</FieldLabel>
            <TimeField id={`${uid}-start`} value={start} onValueChange={setStart} />
          </Field>
          <Field data-invalid={endError ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-end`}>Ends</FieldLabel>
            <TimeField
              id={`${uid}-end`}
              value={end}
              onValueChange={setEnd}
              onValidityChange={setEndError}
              after={start ?? undefined}
              aria-describedby={endError ? `${uid}-end-error` : undefined}
            />
          </Field>
        </div>
        {endError ? <FieldError id={`${uid}-end-error`} className="-mt-3">{endError}</FieldError> : null}
        <Field>
          <FieldLabel id={`${uid}-capacity`}>Capacity</FieldLabel>
          <Slider
            aria-labelledby={`${uid}-capacity`}
            min={20}
            max={300}
            step={10}
            value={capacity}
            onValueChange={setCapacity}
            formatValue={(value) => `${value} people`}
          />
        </Field>
        <Field orientation="horizontal">
          <div className="flex flex-1 flex-col gap-0.5">
            <FieldLabel htmlFor={`${uid}-apply`}>Require an application</FieldLabel>
            <FieldDescription>Admins review each one before registration opens.</FieldDescription>
          </div>
          <Switch
            id={`${uid}-apply`}
            checked={applications}
            onCheckedChange={setApplications}
          />
        </Field>
      </CardContent>
    </Panel>
  );
}

/** The date and time pickers as they look open, without their fields. */
function Pickers() {
  const [date, setDate] = useState<IsoDate | null>("2026-11-18");
  const [time, setTime] = useState<WallTime>("18:00");
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="overlay-surface w-full rounded-2xl p-4">
        <DatePicker value={date} onValueChange={setDate} today={TODAY} min={TODAY} />
      </div>
      <div className="overlay-surface w-60 max-w-full rounded-2xl p-2">
        <TimePicker
          options={timeOptions({ after: "17:00" })}
          value={time}
          onValueChange={setTime}
        />
      </div>
    </div>
  );
}

function ColourAndTicket() {
  const [colour, setColour] = useState("#325DC4");
  const [custom, setCustom] = useState<string[]>(["#E4572E"]);
  return (
    <Panel>
      <CardHeader>
        <CardTitle>Event colour</CardTitle>
        <CardDescription>Tickets and the event page take this colour.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ColourPicker
          label="Event colour"
          value={colour}
          onValueChange={setColour}
          customColours={custom}
          onCustomColoursChange={setCustom}
        />
        <Ticket
          eventName="UXathon 2027"
          holderName="Alex Chen"
          eventColour={colour}
          code={<QrCode value={QR_TOKEN} />}
        />
      </CardContent>
    </Panel>
  );
}

function VenueAndJudges() {
  const uid = useId();
  const [venue, setVenue] = useState<string | null>("angu");
  const [judges, setJudges] = useState<string[]>(["alex", "priya"]);
  const [audience, setAudience] = useState("members");
  return (
    <Panel>
      <CardHeader>
        <span className="text-label tabular-nums text-muted-foreground">06/06</span>
        <CardTitle className="text-h3">Where and who</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-body-medium">Venue</span>
          <SearchableDropdown
            options={VENUES}
            value={venue}
            onValueChange={setVenue}
            placeholder="Search venues"
            aria-label="Venue"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-body-medium">Judges</span>
          <SearchableDropdown
            options={JUDGES}
            multiple
            value={judges}
            onValueChange={setJudges}
            placeholder="Search members"
            addPlaceholder="Add a judge"
            aria-label="Judges"
          />
        </div>
        <Field>
          <FieldLabel htmlFor={`${uid}-audience`}>Who can register</FieldLabel>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger id={`${uid}-audience`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anyone">Anyone with an account</SelectItem>
              <SelectItem value="members">Members only</SelectItem>
              <SelectItem value="application">By application</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Panel>
  );
}

const SECTION_COPY: Record<string, string> = {
  complete: "Everything here is filled in.",
  attention: "The end time is before the start time.",
  "not-started": "Nothing filled in yet. Students need a price before they can register.",
  optional: "Optional. Skip it, or come back after publishing.",
};

function SetupOutline() {
  const [current, setCurrent] = useState("schedule");
  const index = BUILDER_SECTIONS.findIndex((section) => section.id === current);
  const section = BUILDER_SECTIONS[index];
  return (
    <Panel className="pb-4">
      <CardHeader>
        <span className="text-label tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}/{String(BUILDER_SECTIONS.length).padStart(2, "0")}
        </span>
        <CardTitle className="text-h3">{section.title}</CardTitle>
        <CardDescription>{SECTION_COPY[section.state]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" aria-hidden>
        <div className="h-10 rounded-xl border border-border-subtle bg-muted" />
        <div className="h-10 w-2/3 rounded-xl border border-border-subtle bg-muted" />
      </CardContent>
      <div className="flex justify-center px-4">
        {/* The pill floats at the bottom of the window on the real page; here it sits in the card. */}
        <SectionNavigator
          title="Event setup"
          sections={BUILDER_SECTIONS}
          currentId={current}
          onNavigate={setCurrent}
          className="static max-w-full translate-x-0"
        />
      </div>
    </Panel>
  );
}

function DateLocationForm() {
  const [state, setState] = useState({ ...defaultFormState, max_capacity: "120", date_location: {
    automatic: true, audience: "going", location: { ...emptyLocation(), building: "AMS Student Nest", room: "Room 2306", address: "6133 University Blvd, Vancouver", public_summary: "UBC Vancouver" }, dates: [
      { key: "saturday", session_id: null, date: "2099-11-14", start: "09:00", end: "17:00", label: "Opening ceremony", location: null },
      { key: "sunday", session_id: null, date: "2099-11-15", start: "10:00", end: "17:00", label: "Workshops", location: null },
    ],
  } as EventDateLocationDraft });
  return <div className="space-y-4"><EventDateLocation value={state.date_location} disabled={false} showErrors={true} onChange={date_location => setState(current => ({ ...current, date_location }))} /><EventRegistration state={state} disabled={false} info={{ locked: false, seats: 0 }} onChange={(key, value) => setState(current => ({ ...current, [key]: value }))} /></div>;
}

export const BUILDER_COMPONENTS = {
  "builder-basics": Basics,
  "builder-date-location": DateLocationForm,
  "builder-schedule": Schedule,
  "pickers": Pickers,
  "event-colour": ColourAndTicket,
  "venue-and-judges": VenueAndJudges,
  "setup-outline": SetupOutline,
} satisfies Components;
