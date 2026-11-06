"use client";

import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  joinIds,
} from "@/components/ui/field";

import { QuestionText, questionAnchorId, type QuestionFieldProps } from "./shared";

/** A `checkbox` question: pick any of the options. Answers keep the options' order. */
export function CheckboxGroupField({
  question,
  number,
  value,
  error,
  disabled,
  onChange,
}: QuestionFieldProps<string[]>) {
  const uid = useId();
  const descriptionId = `${uid}-description`;
  const errorId = `${uid}-error`;
  const options = (question.response_options ?? []).filter(Boolean);
  const describedBy = joinIds(
    question.description ? descriptionId : undefined,
    error ? errorId : undefined
  );

  const toggle = (option: string, checked: boolean) => {
    const chosen = new Set(value);
    if (checked) chosen.add(option);
    else chosen.delete(option);
    onChange(options.filter((candidate) => chosen.has(candidate)));
  };

  return (
    <Field id={questionAnchorId(question.id)} data-invalid={error ? true : undefined}>
      <FieldSet className="gap-0">
        <FieldLegend variant="label" className="mb-4">
          <QuestionText number={number} question={question} hint="Pick any" />
        </FieldLegend>
        {question.description ? (
          <FieldDescription id={descriptionId} className="-mt-2 mb-4">
            {question.description}
          </FieldDescription>
        ) : null}
        <div data-slot="checkbox-group" className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {options.map((option, index) => {
            const id = `${uid}-${index}`;
            return (
              <Field key={option} orientation="horizontal" className="items-start">
                <Checkbox
                  id={id}
                  checked={value.includes(option)}
                  onCheckedChange={(checked) => toggle(option, checked)}
                  disabled={disabled}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy}
                />
                <FieldLabel htmlFor={id} className="text-small font-normal">
                  {option}
                </FieldLabel>
              </Field>
            );
          })}
        </div>
      </FieldSet>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}
