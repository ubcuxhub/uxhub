"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  applicationFileName,
  decodeCheckboxResponse,
} from "@/lib/application-response";

interface ApplicationResponseCardProps {
  question: string;
  response: string;
  /** The question's type; checkbox and file answers render specially. */
  responseType?: string;
  /** The question's options, which let a legacy checkbox answer split cleanly. */
  responseOptions?: string[] | null;
  /** A signed download link for a file answer. */
  fileUrl?: string | null;
}

const EMPTY = "No response provided";

export function ApplicationResponseCard({
  question,
  response,
  responseType,
  responseOptions,
  fileUrl,
}: ApplicationResponseCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-subheading">{question}</CardTitle>
      </CardHeader>
      <CardContent className="text-small text-muted-foreground">
        <ResponseValue
          response={response}
          responseType={responseType}
          responseOptions={responseOptions}
          fileUrl={fileUrl}
        />
      </CardContent>
    </Card>
  );
}

function ResponseValue({
  response,
  responseType,
  responseOptions,
  fileUrl,
}: Omit<ApplicationResponseCardProps, "question">) {
  if (responseType === "checkbox") {
    const values = decodeCheckboxResponse(response, responseOptions);
    if (values.length === 0) return <p>{EMPTY}</p>;
    return (
      <ul className="list-disc space-y-1 pl-5">
        {values.map((value, index) => (
          <li key={`${index}-${value}`}>{value}</li>
        ))}
      </ul>
    );
  }

  if (responseType === "file_upload") {
    const name = applicationFileName(response);
    if (!name) return <p>{EMPTY}</p>;
    if (!fileUrl) return <p>{name} (unavailable)</p>;
    return (
      <a
        href={fileUrl}
        className="text-primary underline underline-offset-4"
        target="_blank"
        rel="noopener noreferrer"
      >
        {name}
      </a>
    );
  }

  return <p className="whitespace-pre-wrap">{response || EMPTY}</p>;
}
