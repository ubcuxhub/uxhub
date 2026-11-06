"use client";

import { useId } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
  joinIds,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import { QuestionText, questionAnchorId, type QuestionFieldProps } from "./shared";

/**
 * A `multiple_choice` question as radio cards: the library's radio-card
 * composition (a `FieldLabel` wrapping a `Field`), one card per option label.
 */
export function ChoiceCardsField({
  question,
  number,
  value,
  error,
  disabled,
  onChange,
}: QuestionFieldProps<string>) {
  const uid = useId();
  const descriptionId = `${uid}-description`;
  const errorId = `${uid}-error`;
  const options = (question.response_options ?? []).filter(Boolean);

  return (
    <Field id={questionAnchorId(question.id)} data-invalid={error ? true : undefined}>
      <FieldSet className="gap-0">
        <FieldLegend variant="label" className="mb-4">
          <QuestionText number={number} question={question} />
        </FieldLegend>
        {question.description ? (
          <FieldDescription id={descriptionId} className="-mt-2 mb-4">
            {question.description}
          </FieldDescription>
        ) : null}
        <RadioGroup
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinIds(
            question.description ? descriptionId : undefined,
            error ? errorId : undefined
          )}
          className="grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {options.map((option, index) => {
            const id = `${uid}-${index}`;
            return (
              <FieldLabel
                key={option}
                htmlFor={id}
                className={cn("[&>*]:data-[slot=field]:p-3", error && "border-destructive")}
              >
                <Field orientation="horizontal" data-disabled={disabled || undefined}>
                  <RadioGroupItem
                    value={option}
                    id={id}
                    aria-invalid={error ? true : undefined}
                  />
                  <FieldTitle className="font-medium">{option}</FieldTitle>
                </Field>
              </FieldLabel>
            );
          })}
        </RadioGroup>
      </FieldSet>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}
