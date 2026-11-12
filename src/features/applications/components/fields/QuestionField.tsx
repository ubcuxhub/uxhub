"use client";

import type { AnswerValue } from "@/features/applications/lib/application-form";

import { CheckboxGroupField } from "./CheckboxGroupField";
import { ChoiceCardsField } from "./ChoiceCardsField";
import { DropdownField } from "./DropdownField";
import { FileField, type FileFieldProps } from "./FileField";
import { LongTextField } from "./LongTextField";
import { ShortTextField } from "./ShortTextField";
import type { QuestionFieldProps } from "./shared";

export type QuestionFieldDispatchProps = QuestionFieldProps<AnswerValue> &
  Pick<FileFieldProps, "onUpload" | "onRemove" | "fileSize">;

const asText = (value: AnswerValue) => (typeof value === "string" ? value : "");
const asList = (value: AnswerValue) => (Array.isArray(value) ? value : []);

/** The control for one question, picked by its `response_type`. */
export function QuestionField({
  onUpload,
  onRemove,
  fileSize,
  value,
  onChange,
  ...props
}: QuestionFieldDispatchProps) {
  switch (props.question.response_type) {
    case "multiple_choice":
      return <ChoiceCardsField {...props} value={asText(value)} onChange={onChange} />;
    case "checkbox":
      return <CheckboxGroupField {...props} value={asList(value)} onChange={onChange} />;
    case "dropdown":
      return <DropdownField {...props} value={asText(value)} onChange={onChange} />;
    case "long_text":
      return <LongTextField {...props} value={asText(value)} onChange={onChange} />;
    case "file_upload":
      return (
        <FileField
          {...props}
          value={asText(value)}
          onUpload={onUpload}
          onRemove={onRemove}
          fileSize={fileSize}
        />
      );
    case "short_text":
    default:
      return <ShortTextField {...props} value={asText(value)} onChange={onChange} />;
  }
}
