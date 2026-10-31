"use client";

import { useId, useState } from "react";

import { DateField, TimeField } from "@/components/ui/date-time-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { TimePicker } from "@/components/ui/time-picker";
import {
  timeOptions,
  type IsoDate,
  type WallTime,
} from "@/lib/date-input";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const OPEN_STATES = ["date-open", "time-open", "end-time-open"] as const;

/** Fixed, so the gallery looks the same on any day. A Sunday, like Figma's. */
const TODAY: IsoDate = "2026-11-04";
const DATE: IsoDate = "2026-11-14";

/** Room under a field for its popover when that state is forced open. */
const openRoom = "min-h-[27rem] items-start";

function Labelled({
  label,
  children,
  error,
  htmlFor,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/** A field you can type in, with its error shown the way a form would. */
function LiveDate({ label, id }: { label: string; id: string }) {
  const [value, setValue] = useState<IsoDate | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Labelled label={label} htmlFor={id} error={error}>
      <DateField
        id={id}
        value={value}
        onValueChange={setValue}
        onValidityChange={setError}
        today={TODAY}
        min={TODAY}
      />
    </Labelled>
  );
}

function LiveTime({
  label,
  id,
  after,
  defaultValue = null,
  defaultOpen,
}: {
  label: string;
  id: string;
  after?: WallTime;
  defaultValue?: WallTime | null;
  defaultOpen?: boolean;
}) {
  const [value, setValue] = useState<WallTime | null>(defaultValue);
  const [error, setError] = useState<string | null>(null);
  return (
    <Labelled label={label} htmlFor={id} error={error}>
      <TimeField
        id={id}
        value={value}
        onValueChange={setValue}
        onValidityChange={setError}
        after={after}
        defaultOpen={defaultOpen}
      />
    </Labelled>
  );
}

function EventSchedule({ ids }: { ids: [string, string, string] }) {
  const [date, setDate] = useState<IsoDate | null>(DATE);
  const [start, setStart] = useState<WallTime | null>("09:00");
  const [end, setEnd] = useState<WallTime | null>("08:30");
  const [endError, setEndError] = useState<string | null>(null);

  return (
    <div className="grid max-w-3xl items-start gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
      <Labelled label="Start date" htmlFor={ids[0]}>
        <DateField
          id={ids[0]}
          value={date}
          onValueChange={setDate}
          today={TODAY}
          min={TODAY}
        />
      </Labelled>
      <Labelled label="Start time" htmlFor={ids[1]}>
        <TimeField id={ids[1]} value={start} onValueChange={setStart} />
      </Labelled>
      <Labelled label="End time" htmlFor={ids[2]} error={endError}>
        <TimeField
          id={ids[2]}
          value={end}
          onValueChange={setEnd}
          onValidityChange={setEndError}
          after={start ?? undefined}
        />
      </Labelled>
    </div>
  );
}

function DateTime({ open }: SectionProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [picked, setPicked] = useState<IsoDate | null>(DATE);
  const [time, setTime] = useState<WallTime | null>("09:00");
  const [endTime, setEndTime] = useState<WallTime | null>("12:00");

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Date field"
        spec="§3.11"
        description="A 40px pill, type or pick. On blur the text is read and tidied to “Sat, Nov 14, 2026”."
        min="16rem"
      >
        <Specimen label="placeholder">
          <div className="w-full">
            <Labelled label="Date" htmlFor={id("d-empty")}>
              <DateField id={id("d-empty")} value={null} onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="filled">
          <div className="w-full">
            <Labelled label="Date" htmlFor={id("d-filled")}>
              <DateField id={id("d-filled")} value={DATE} onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="focus">
          <div className="w-full [&_input]:focus-ring">
            <Labelled label="Date" htmlFor={id("d-focus")}>
              <DateField id={id("d-focus")} value={DATE} onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="error">
          <div className="w-full">
            <Labelled
              label="Date"
              htmlFor={id("d-error")}
              error="Use a real date, like Nov 14."
            >
              <DateField
                id={id("d-error")}
                value={null}
                onValueChange={() => {}}
                aria-invalid
              />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="disabled">
          <div className="w-full">
            <Labelled label="Date" htmlFor={id("d-disabled")}>
              <DateField
                id={id("d-disabled")}
                value={DATE}
                onValueChange={() => {}}
                disabled
              />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="try it: type “feb 30”, “nov 14” or “tomorrow”, then Tab (min = Nov 4)">
          <div className="w-full">
            <LiveDate label="Date" id={id("d-live")} />
          </div>
        </Specimen>
        <Specimen
          label="calendar open (?open=date-open)"
          wide
          className={open === "date-open" ? openRoom : undefined}
        >
          <div className="w-full max-w-xs">
            <Labelled label="Date" htmlFor={id("d-open")}>
              <DateField
                key={open}
                id={id("d-open")}
                value={picked}
                onValueChange={setPicked}
                today={TODAY}
                min={TODAY}
                defaultOpen={open === "date-open"}
              />
            </Labelled>
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Time field"
        spec="§3.11"
        description="A combobox over a list of times. Without AM or PM, a time reads as PM."
        min="16rem"
      >
        <Specimen label="placeholder">
          <div className="w-full">
            <Labelled label="Time" htmlFor={id("t-empty")}>
              <TimeField id={id("t-empty")} value={null} onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="filled">
          <div className="w-full">
            <Labelled label="Time" htmlFor={id("t-filled")}>
              <TimeField id={id("t-filled")} value="21:00" onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="focus">
          <div className="w-full [&_input]:focus-ring">
            <Labelled label="Time" htmlFor={id("t-focus")}>
              <TimeField id={id("t-focus")} value="21:00" onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="error">
          <div className="w-full">
            <Labelled
              label="Time"
              htmlFor={id("t-error")}
              error="Use a real time, like 9:00 AM."
            >
              <TimeField
                id={id("t-error")}
                value={null}
                onValueChange={() => {}}
                aria-invalid
              />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="disabled">
          <div className="w-full">
            <Labelled label="Time" htmlFor={id("t-disabled")}>
              <TimeField
                id={id("t-disabled")}
                value="21:00"
                onValueChange={() => {}}
                disabled
              />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="try it: type “9” then Tab, or press ↓">
          <div className="w-full">
            <LiveTime label="Start time" id={id("t-live")} />
          </div>
        </Specimen>
        <Specimen
          label="start time open (?open=time-open)"
          className={open === "time-open" ? openRoom : undefined}
        >
          <div className="w-full">
            <Labelled label="Start time" htmlFor={id("t-open")}>
              <TimeField
                key={open}
                id={id("t-open")}
                value={time}
                onValueChange={setTime}
                defaultOpen={open === "time-open"}
              />
            </Labelled>
          </div>
        </Specimen>
        <Specimen
          label="end time open, after 10:00 AM (?open=end-time-open)"
          className={open === "end-time-open" ? openRoom : undefined}
        >
          <div className="w-full">
            <Labelled label="End time" htmlFor={id("t-end")}>
              <TimeField
                key={open}
                id={id("t-end")}
                value={endTime}
                onValueChange={setEndTime}
                after="10:00"
                defaultOpen={open === "end-time-open"}
              />
            </Labelled>
          </div>
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Pickers"
        spec="§3.11"
        description="The popover panels on their own, as they look when open. Today is Nov 4, 2026."
        min="min(22rem, 100%)"
      >
        <Specimen label="DatePicker: today, selected" bare>
          <div className="overlay-surface w-82 max-w-full rounded-2xl p-4">
            <DatePicker value={DATE} onValueChange={() => {}} today="2026-11-01" />
          </div>
        </Specimen>
        <Specimen label="DatePicker: out of range (min = today)" bare>
          <div className="overlay-surface w-82 max-w-full rounded-2xl p-4">
            <DatePicker value={DATE} onValueChange={() => {}} today={TODAY} min={TODAY} />
          </div>
        </Specimen>
        <Specimen label="TimePicker: start" bare>
          <div className="overlay-surface w-60 rounded-2xl p-2">
            <TimePicker options={timeOptions()} value="09:00" onValueChange={() => {}} />
          </div>
        </Specimen>
        <Specimen label="TimePicker: end, after 10:00 AM, with durations" bare>
          <div className="overlay-surface w-60 rounded-2xl p-2">
            <TimePicker
              options={timeOptions({ after: "10:00" })}
              value="12:00"
              onValueChange={() => {}}
              activeIndex={9}
            />
          </div>
        </Specimen>
      </SpecimenGroup>

      <Composition
        title="Event schedule"
        description="Start date, start time and end time on one row. The end time is read after the start: set the start to 9:00 AM and type “11” for 11:00 AM. It starts out before the start time to show the error."
      >
        <EventSchedule ids={[id("s-date"), id("s-start"), id("s-end")]} />
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "date-time",
  title: "Date and time",
  spec: "§3.11",
  layout: "split",
  openStates: OPEN_STATES,
  Component: DateTime,
};

export default section;
