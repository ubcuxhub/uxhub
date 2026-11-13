"use client";

import { useId } from "react";

import { Field, FieldDescription, FieldError, FieldLabel, joinIds } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { QuestionText, questionAnchorId, type QuestionFieldProps } from "./shared";

/** A `dropdown` question: one option from a Select. */
export function DropdownField({
  question,
  number,
  value,
  error,
  disabled,
  onChange,
}: QuestionFieldProps<string>) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const options = (question.response_options ?? []).filter(Boolean);

  return (
    <Field id={questionAnchorId(question.id)} className="gap-4">
      <FieldLabel htmlFor={id}>
        <QuestionText number={number} question={question} />
      </FieldLabel>
      {question.description ? (
        <FieldDescription id={descriptionId} className="-mt-2">
          {question.description}
        </FieldDescription>
      ) : null}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={joinIds(
            question.description ? descriptionId : undefined,
            error ? errorId : undefined
          )}
        >
          <SelectValue placeholder="Choose an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={errorId} className="-mt-2">
        {error}
      </FieldError>
    </Field>
  );
}
