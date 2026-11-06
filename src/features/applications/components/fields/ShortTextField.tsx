"use client";

import { useId } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { QuestionText, questionAnchorId, type QuestionFieldProps } from "./shared";

/** A `short_text` question: one line, stopped at `max_char_limit`. */
export function ShortTextField({
  question,
  number,
  value,
  error,
  disabled,
  onChange,
}: QuestionFieldProps<string>) {
  const id = useId();

  return (
    <Field id={questionAnchorId(question.id)} className="gap-4">
      <FieldLabel htmlFor={id}>
        <QuestionText number={number} question={question} />
      </FieldLabel>
      {question.description ? (
        <FieldDescription className="-mt-2">{question.description}</FieldDescription>
      ) : null}
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter your answer"
        maxLength={question.max_char_limit ?? undefined}
        disabled={disabled}
      />
      <FieldError className="-mt-2">{error}</FieldError>
    </Field>
  );
}
