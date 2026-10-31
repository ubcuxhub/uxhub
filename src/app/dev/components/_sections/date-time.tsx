"use client";

import { useId, useState } from "react";

import { DateField } from "@/components/ui/date-time-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { IsoDate } from "@/lib/date-input";

import { Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection, SectionProps } from "../_gallery/types";

const OPEN_STATES = ["date-open"] as const;

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

function DateTime({ open }: SectionProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [picked, setPicked] = useState<IsoDate | null>(DATE);

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
                aria-describedby={`${id("d-error")}-error`}
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
        title="Date picker"
        spec="§3.11"
        description="The calendar panel on its own, as it looks when open. Today is Nov 4, 2026."
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
      </SpecimenGroup>

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
