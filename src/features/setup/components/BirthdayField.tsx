"use client";

import { useId } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { INCOMPLETE_BIRTH_DATE, latestBirthDate } from "@/lib/birth-date";

export const BIRTHDAY_LABEL = "Birthday";
export const BIRTHDAY_HINT = "Only UX Hub execs see this.";

interface BirthdayFieldProps {
  /** `YYYY-MM-DD`, "" for none, or `INCOMPLETE_BIRTH_DATE` while half-typed. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Shown under the hint; the caller decides when (after blur, on submit). */
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/** What the input holds: a half-typed date reports "" natively, so name it instead. */
function readInput(input: HTMLInputElement): string {
  return input.validity.badInput ? INCOMPLETE_BIRTH_DATE : input.value;
}

/**
 * The member's optional birthday, the same in setup step 1 and Settings ›
 * Profile: label, native date input, hint and error. Check what it holds with
 * `birthDateError` and save it through `saveBirthDateAction`, which runs the
 * same validator.
 */
export function BirthdayField({ value, onChange, onBlur, error, disabled, className }: BirthdayFieldProps) {
  const id = useId();
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id} className="items-baseline">
        {BIRTHDAY_LABEL}
        <span className="text-small font-normal text-muted-foreground">Optional</span>
      </FieldLabel>
      <Input
        id={id}
        type="date"
        // A half-typed date stays in the input: "" matches what it reports.
        value={value === INCOMPLETE_BIRTH_DATE ? "" : value}
        max={latestBirthDate()}
        autoComplete="bday"
        disabled={disabled}
        onChange={(event) => onChange(readInput(event.target))}
        onBlur={(event) => {
          // Editing inside a half-typed date may not fire a change; catch up.
          const next = readInput(event.target);
          if (next !== value) onChange(next);
          onBlur?.();
        }}
      />
      <FieldDescription>{BIRTHDAY_HINT}</FieldDescription>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
