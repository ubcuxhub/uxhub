"use client";

import { useId } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { USER_TYPE_OPTIONS, type UserTypeId } from "../lib/options";
import { USER_TYPE_LOCKED_MESSAGE } from "../lib/state";

interface AboutFieldsProps {
  /** Null until the member picks one: the stored default isn't an answer. */
  value: UserTypeId | null;
  onChange: (value: UserTypeId) => void;
  /** Names the group: the step's question. */
  label: string;
  /**
   * The member's stored type while it can't change (an active or pending
   * membership); every other option is disabled, with the reason below.
   */
  lockedTo?: UserTypeId | null;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * Step 1 of setup: "What best describes you?" as radio cards (the library's
 * `FieldLabel` around a `Field`, which highlights the checked card). The
 * question is the step's heading, so the group takes it as its label rather
 * than repeating it as a visible legend.
 */
export function AboutFields({
  value,
  onChange,
  label,
  lockedTo = null,
  invalid,
  disabled,
}: AboutFieldsProps) {
  const uid = useId();
  const noteId = `${uid}-locked`;
  return (
    <div data-slot="about-fields" className="flex flex-col gap-3">
      <RadioGroup
        aria-label={label}
        aria-describedby={lockedTo ? noteId : undefined}
        aria-invalid={invalid || undefined}
        value={value ?? ""}
        onValueChange={(next) => onChange(next as UserTypeId)}
        disabled={disabled}
        className="gap-3"
      >
        {USER_TYPE_OPTIONS.map((option) => {
          const id = `${uid}-${option.id}`;
          const optionDisabled = disabled || (lockedTo !== null && option.id !== lockedTo);
          return (
            <FieldLabel key={option.id} htmlFor={id}>
              <Field orientation="horizontal" data-disabled={optionDisabled || undefined}>
                <FieldContent>
                  <FieldTitle>{option.title}</FieldTitle>
                  <FieldDescription>{option.description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value={option.id}
                  id={id}
                  disabled={optionDisabled}
                  aria-invalid={invalid || undefined}
                />
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
      {lockedTo ? (
        <p id={noteId} className="text-small text-muted-foreground">
          {USER_TYPE_LOCKED_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
