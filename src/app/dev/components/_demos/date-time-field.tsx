"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DateField,
  DateTimeField,
  DateTimeFieldPair,
  TimeField,
  type DateTimeValue,
} from "@/components/ui/date-time-field";
import { Field, FieldError, FieldLabel, FieldLabelRow } from "@/components/ui/field";
import type { IsoDate, WallTime } from "@/lib/date-input";

import { Composition, Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";
import type { SectionProps } from "@/app/dev/_shell/types";

import { DATE, TODAY } from "./_fixtures/date-time";

/** Room under a field for its popover when that state is forced open. */
const openRoom = "min-h-[27rem]";

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
  const errorId = `${htmlFor}-error`;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
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
        aria-describedby={error ? `${id}-error` : undefined}
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
        aria-describedby={error ? `${id}-error` : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
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
          aria-describedby={endError ? `${ids[2]}-error` : undefined}
          aria-errormessage={endError ? `${ids[2]}-error` : undefined}
        />
      </Labelled>
    </div>
  );
}

/** One moment, with a Clear label action and the field's own error. */
function Moment({
  id,
  label,
  initial,
  width,
}: {
  id: string;
  label: string;
  initial: DateTimeValue;
  width: string;
}) {
  const [value, setValue] = useState<DateTimeValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = Boolean(value.date || value.time);
  return (
    <div className={width}>
      <Field aria-labelledby={`${id}-label`} data-invalid={error ? true : undefined}>
        <FieldLabelRow
          action={
            set ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                aria-label={`Clear ${label.toLowerCase()}`}
                onClick={() => setValue({ date: null, time: null })}
              >
                Clear
              </Button>
            ) : null
          }
        >
          <FieldLabel id={`${id}-label`} htmlFor={id}>
            {label}
          </FieldLabel>
        </FieldLabelRow>
        <DateTimeField
          id={id}
          dateLabel={`${label} date`}
          timeLabel={`${label} time`}
          value={value}
          onValueChange={setValue}
          onValidityChange={setError}
          today={TODAY}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    </div>
  );
}

function DateTimeFieldDemo({ open }: SectionProps) {
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
      >
        <Specimen label="placeholder" className="w-64">
          <div className="w-full">
            <Labelled label="Date" htmlFor={id("d-empty")}>
              <DateField id={id("d-empty")} value={null} onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="filled" className="w-64">
          <div className="w-full">
            <Labelled label="Date" htmlFor={id("d-filled")}>
              <DateField id={id("d-filled")} value={DATE} onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="focus" className="w-64">
          <div className="w-full [&_input]:focus-ring">
            <Labelled label="Date" htmlFor={id("d-focus")}>
              <DateField id={id("d-focus")} value={DATE} onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="error" className="w-64">
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
                aria-describedby={`${id("d-error")}-error`}
              />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="disabled" className="w-64">
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
        <Specimen label="try it: type “feb 30”, “nov 14” or “tomorrow”, then Tab (min = Nov 4)" className="w-64">
          <div className="w-full">
            <LiveDate label="Date" id={id("d-live")} />
          </div>
        </Specimen>
        <Specimen
          label="calendar open (?open=date-open)"
          className={open === "date-open" ? `w-64 ${openRoom}` : "w-64"}
        >
          <div className="w-full">
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
      >
        <Specimen label="placeholder" className="w-64">
          <div className="w-full">
            <Labelled label="Time" htmlFor={id("t-empty")}>
              <TimeField id={id("t-empty")} value={null} onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="filled" className="w-64">
          <div className="w-full">
            <Labelled label="Time" htmlFor={id("t-filled")}>
              <TimeField id={id("t-filled")} value="21:00" onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="focus" className="w-64">
          <div className="w-full [&_input]:focus-ring">
            <Labelled label="Time" htmlFor={id("t-focus")}>
              <TimeField id={id("t-focus")} value="21:00" onValueChange={() => {}} />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="error" className="w-64">
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
                aria-describedby={`${id("t-error")}-error`}
                aria-errormessage={`${id("t-error")}-error`}
              />
            </Labelled>
          </div>
        </Specimen>
        <Specimen label="disabled" className="w-64">
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
        <Specimen label="try it: type “9” then Tab, or press ↓" className="w-64">
          <div className="w-full">
            <LiveTime label="Start time" id={id("t-live")} />
          </div>
        </Specimen>
        <Specimen
          label="start time open (?open=time-open)"
          className={open === "time-open" ? `w-64 ${openRoom}` : "w-64"}
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
          className={open === "end-time-open" ? `w-64 ${openRoom}` : "w-64"}
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
        title="Date and time"
        spec="§3.11"
        description="One moment as a date and a time. Side by side when its container is 24rem or wider, stacked below that, so it fits a drawer or a phone. Clear sits in the label row."
      >
        <Specimen label="wide container (side by side)" className="w-md max-w-full">
          <Moment
            id={id("dt-wide")}
            label="Registration opens"
            initial={{ date: DATE, time: "09:00" }}
            width="w-full"
          />
        </Specimen>
        <Specimen label="narrow container (stacked)" className="w-72 max-w-full">
          <Moment
            id={id("dt-narrow")}
            label="Registration closes"
            initial={{ date: DATE, time: "17:00" }}
            width="w-full"
          />
        </Specimen>
        <Specimen label="empty" className="w-md max-w-full">
          <Moment
            id={id("dt-empty")}
            label="Publishes"
            initial={{ date: null, time: null }}
            width="w-full"
          />
        </Specimen>
      </SpecimenGroup>
      <Composition title="Responsive date/time pair" description="DateTimeFieldPair responds to its own available width: stacked below 24rem (384px), a date plus an 8rem time column at 24rem and above. Resize the gallery or place it inside a narrow card; labels and tab order stay date then time. Check phone, sidebar-expanded and collapsed layouts, both themes and densities.">
        <div className="w-full max-w-xl resize-x overflow-auto p-1">
          <DateTimeFieldPair
            date={<Labelled label="Date" htmlFor={id("pair-date")}><DateField id={id("pair-date")} value={picked} onValueChange={setPicked} /></Labelled>}
            time={<Labelled label="Time" htmlFor={id("pair-time")}><TimeField id={id("pair-time")} value={time} onValueChange={setTime} /></Labelled>}
          />
        </div>
      </Composition>

      <Composition
        title="Event schedule"
        description="Start date, start time and end time on one row. The end time is read after the start: set the start to 9:00 AM and type “11” for 11:00 AM. It starts out before the start time to show the error."
      >
        <EventSchedule ids={[id("s-date"), id("s-start"), id("s-end")]} />
      </Composition>
    </div>
  );
}

export default DateTimeFieldDemo;
