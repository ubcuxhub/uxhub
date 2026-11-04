"use client";

import { useId } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

/** The focus ring a keyboard user sees, forced on so it can be looked at. */
const FORCED_FOCUS = "focus-ring";

const DESCRIPTION =
  "A three-week design sprint for UBC students, from problem statement to final pitch.";

function TextareaDemo() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup title="Textarea" spec="§3.12">
        <Specimen label="empty, placeholder" className="w-64">
          <Textarea aria-label="Empty" placeholder="Tell us about the event" />
        </Specimen>
        <Specimen label="filled" className="w-64">
          <Textarea
            aria-label="Filled"
            defaultValue="A night of design critique, pizza and portfolio feedback from industry mentors."
          />
        </Specimen>
        <Specimen label="aria-invalid" className="w-64">
          <Textarea aria-label="Invalid" defaultValue="Too short" aria-invalid />
        </Specimen>
        <Specimen label="disabled" className="w-64">
          <Textarea aria-label="Disabled" placeholder="Tell us about the event" disabled />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Textarea with a counter"
        spec="§3.12"
        description="showCount with maxLength. The counter goes red on an invalid field and at the limit; the screen-reader line speaks at 20 left or fewer. 120px tall here to match Figma (the default stays min-h-20)."
      >
        <Specimen label="Filled · 83/280" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("ta-filled")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-filled")}
              className="min-h-30"
              maxLength={280}
              showCount
              defaultValue={DESCRIPTION}
            />
          </Field>
        </Specimen>
        <Specimen label="Focus (ring forced on)" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("ta-focus")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-focus")}
              className={`min-h-30 ${FORCED_FOCUS}`}
              maxLength={280}
              showCount
              defaultValue={DESCRIPTION}
            />
          </Field>
        </Specimen>
        <Specimen label="Placeholder · 0/280" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("ta-empty")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-empty")}
              className="min-h-30"
              maxLength={280}
              showCount
              placeholder="For example, what attendees will make or learn"
            />
          </Field>
        </Specimen>
        <Specimen label="Error · counter red" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("ta-error")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-error")}
              className="min-h-30"
              maxLength={280}
              showCount
              aria-invalid
            />
            <FieldError>Add a short description.</FieldError>
          </Field>
        </Specimen>
        <Specimen label="Disabled" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("ta-disabled")}>Short description</FieldLabel>
            <Textarea
              id={id("ta-disabled")}
              className="min-h-30"
              maxLength={280}
              showCount
              disabled
              defaultValue="Registration is closed for this event."
            />
          </Field>
        </Specimen>
        <Specimen label="Near the limit · 59/60, type one more character" className="w-64">
          <Field>
            <FieldLabel htmlFor={id("ta-limit")}>Tagline</FieldLabel>
            <Textarea
              id={id("ta-limit")}
              maxLength={60}
              showCount
              defaultValue="Three weeks, one problem statement, and a pitch at the end."
            />
          </Field>
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default TextareaDemo;
