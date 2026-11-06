import type { ReactNode } from "react";

import type { ApplicationQuestion } from "@/features/applications/lib/application-form";

/** What every question control takes. `onChange` gets the new answer. */
export interface QuestionFieldProps<Value> {
  question: ApplicationQuestion;
  /** 1-based, shown before the question. */
  number: number;
  value: Value;
  error?: string;
  disabled?: boolean;
  onChange: (value: Value) => void;
}

/** The DOM id a review chip scrolls to. */
export function questionAnchorId(questionId: string) {
  return `question-${questionId}`;
}

/** "3. Which roles are you interested in? (optional) Pick any" */
export function QuestionText({
  number,
  question,
  hint,
}: {
  number: number;
  question: ApplicationQuestion;
  hint?: ReactNode;
}) {
  return (
    <>
      {number}. {question.question}
      {question.is_required ? null : " (optional)"}
      {hint ? (
        <span className="text-small font-normal text-muted-foreground"> {hint}</span>
      ) : null}
    </>
  );
}
