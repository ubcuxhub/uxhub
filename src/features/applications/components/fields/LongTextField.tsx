"use client";

import { useId } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

import { QuestionText, questionAnchorId, type QuestionFieldProps } from "./shared";

/** A `long_text` question. With a `max_char_limit`, input stops there and a counter shows. */
export function LongTextField({
  question,
  number,
  value,
  error,
  disabled,
  onChange,
}: QuestionFieldProps<string>) {
  const id = useId();
  const limit = question.max_char_limit ?? undefined;

  return (
    <Field id={questionAnchorId(question.id)} className="gap-4">
      <FieldLabel htmlFor={id}>
        <QuestionText number={number} question={question} />
      </FieldLabel>
      {question.description ? (
        <FieldDescription className="-mt-2">{question.description}</FieldDescription>
      ) : null}
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter your answer"
        maxLength={limit}
        showCount={Boolean(limit)}
        disabled={disabled}
        className="min-h-30"
      />
      <FieldError className="-mt-2">{error}</FieldError>
    </Field>
  );
}
