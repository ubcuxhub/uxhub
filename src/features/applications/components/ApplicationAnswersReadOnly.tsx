import { Fragment } from "react";

import { Separator } from "@/components/ui/separator";
import { applicationFileName } from "@/lib/application-response";

import type { ApplicationAnswers, ApplicationQuestion } from "../lib/application-form";
import { QuestionText, questionAnchorId } from "./fields/shared";

interface ApplicationAnswersReadOnlyProps {
  questions: readonly ApplicationQuestion[];
  answers: ApplicationAnswers;
  /** Signed download links for file answers, keyed by question id. */
  fileLinks?: Record<string, string>;
}

/** A submitted application's answers, as text. Nothing here can be edited. */
export function ApplicationAnswersReadOnly({
  questions,
  answers,
  fileLinks = {},
}: ApplicationAnswersReadOnlyProps) {
  return (
    <>
      {questions.map((question, index) => (
        <Fragment key={question.id}>
          {index > 0 ? <Separator className="bg-border-subtle" /> : null}
          <div id={questionAnchorId(question.id)} className="flex flex-col gap-2">
            <p className="text-body-medium">
              <QuestionText number={index + 1} question={question} />
            </p>
            <Answer
              question={question}
              value={answers[question.id]}
              fileLink={fileLinks[question.id]}
            />
          </div>
        </Fragment>
      ))}
    </>
  );
}

function Answer({
  question,
  value,
  fileLink,
}: {
  question: ApplicationQuestion;
  value: ApplicationAnswers[string] | undefined;
  fileLink?: string;
}) {
  const empty = <p className="text-body text-muted-foreground">No answer</p>;

  if (Array.isArray(value)) {
    if (value.length === 0) return empty;
    return (
      <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
        {value.map((option) => (
          <li key={option}>{option}</li>
        ))}
      </ul>
    );
  }
  if (!value?.trim()) return empty;

  if (question.response_type === "file_upload") {
    const name = applicationFileName(value);
    return fileLink ? (
      <a
        href={fileLink}
        className="w-fit text-body text-info-foreground underline underline-offset-4 hover:text-primary focus-visible:focus-ring"
      >
        {name}
      </a>
    ) : (
      <p className="text-body">{name}</p>
    );
  }
  return <p className="text-body whitespace-pre-wrap break-words">{value}</p>;
}
