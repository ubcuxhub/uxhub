"use client";

import {
  ArrowUp,
  ArrowDown,
  LockKeyhole,
  CheckSquare,
  ChevronDown,
  CircleDot,
  FileUp,
  ListMinus,
  Text,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types";
import { APPLICATION_FILE_MAX_BYTES } from "@/lib/supabase-helpers/application-files";

interface ApplicationQuestionsSectionProps {
  registrationModeOwned?: boolean;
  locked?: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  enabled: boolean;
  applicationTemplate: ApplicationQuestionTemplate[];
  questionErrors: Record<number, string>;
  onEnabledChange: (enabled: boolean) => void;
  onAdd: (type: ResponseType) => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof ApplicationQuestionTemplate,
    value: string | ResponseType | number | boolean | string[]
  ) => void;
  onAddResponseOption: (index: number) => void;
  onUpdateResponseOption: (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => void;
  onRemoveResponseOption: (questionIndex: number, optionIndex: number) => void;
}

const questionTypes = [
  { value: ResponseType.short_text, label: "Short form", icon: ListMinus },
  { value: ResponseType.long_text, label: "Long form", icon: Text },
  { value: ResponseType.checkbox, label: "Checkboxes", icon: CheckSquare },
  {
    value: ResponseType.multiple_choice,
    label: "Multiple choice",
    icon: CircleDot,
  },
  { value: ResponseType.file_upload, label: "File upload", icon: FileUp },
  { value: ResponseType.dropdown, label: "Dropdown", icon: ChevronDown },
] as const;

const choiceTypes = new Set<ResponseType>([
  ResponseType.checkbox,
  ResponseType.multiple_choice,
  ResponseType.dropdown,
]);

export function ApplicationQuestionsSection({
  registrationModeOwned = false,
  locked = false,
  onMove,
  enabled,
  applicationTemplate,
  questionErrors,
  onEnabledChange,
  onAdd,
  onRemove,
  onUpdate,
  onAddResponseOption,
  onUpdateResponseOption,
  onRemoveResponseOption,
}: ApplicationQuestionsSectionProps) {
  if (registrationModeOwned && !enabled) return null;
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5"><CardTitle>Application questions</CardTitle><CardDescription>Choose the questions applicants answer. Applications need at least one valid question before publication.</CardDescription></CardHeader>
      <CardContent className="px-5"><FieldSet className="gap-5">
      <div className="flex items-center justify-between gap-4">
        <FieldLegend className="sr-only">Application questions</FieldLegend>
        {!registrationModeOwned && <div className="flex items-center gap-2">
          <Switch
            id="requires_application"
            disabled={locked}
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <FieldLabel htmlFor="requires_application">Enabled</FieldLabel>
        </div>}
      </div>

      {enabled && (
        <FieldGroup className="gap-5">
          {locked && <p className="flex items-start gap-2 rounded-lg bg-muted p-4 text-small"><LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />Application questions are locked because an application has been submitted.</p>}
          {questionErrors[-1] && <FieldError>{questionErrors[-1]}</FieldError>}
          {applicationTemplate.map((question, index) => {
            const type = questionTypes.find(
              (option) => option.value === question.response
            );
            const questionError = questionErrors[index];
            const labelError = questionError === "Question is required." ? questionError : undefined;
            const answerError = labelError ? undefined : questionError;
            return (
              <Card key={question.id ?? `application-${index}`} className="gap-4 py-5">
                <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-5">
                  <CardTitle className="text-body-medium">Question {index + 1} · {type?.label}</CardTitle>
                  {!locked && <div className="flex gap-1">
                    <IconButton className="max-sm:min-h-11 max-sm:min-w-11" label={`Move question ${index + 1} up`} disabled={index === 0} onClick={() => onMove(index, -1)}><ArrowUp aria-hidden /></IconButton>
                    <IconButton className="max-sm:min-h-11 max-sm:min-w-11" label={`Move question ${index + 1} down`} disabled={index === applicationTemplate.length - 1} onClick={() => onMove(index, 1)}><ArrowDown aria-hidden /></IconButton>
                    <IconButton className="max-sm:min-h-11 max-sm:min-w-11" variant="ghost" label={`Remove question ${index + 1}`} onClick={() => onRemove(index)}><X aria-hidden /></IconButton>
                  </div>}
                </CardHeader>
                <CardContent className="space-y-4 px-5">
                {locked ? <div className="space-y-2">
                  <p className="break-words font-medium">{question.question}</p>
                  <p className="text-small text-muted-foreground">{question.is_required ? "Required" : "Optional"}{question.max_char_limit !== "" ? ` · Maximum ${question.max_char_limit} characters` : ""}</p>
                  {choiceTypes.has(question.response) && <ul className="list-inside list-disc space-y-1 text-small">{question.response_options.map((option, optionIndex) => <li className="break-words" key={optionIndex}>{option}</li>)}</ul>}
                </div> : <>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor={`question_required_${index}`}>
                    Required
                  </FieldLabel>
                  <Checkbox
                    id={`question_required_${index}`}
                    checked={question.is_required}
                    onCheckedChange={(checked) =>
                      onUpdate(index, "is_required", checked)
                    }
                  />
                </div>
                <Field data-invalid={labelError ? true : undefined}>
                  <FieldLabel htmlFor={`question_${index}`}>Question</FieldLabel>
                  <Input
                    id={`question_${index}`}
                    value={question.question}
                    onChange={(event) =>
                      onUpdate(index, "question", event.target.value)
                    }
                    aria-describedby={labelError ? `question_${index}_error` : undefined}
                    aria-invalid={labelError ? true : undefined}
                    required
                  />
                  <FieldError id={`question_${index}_error`}>{labelError}</FieldError>
                </Field>
                {(question.response === ResponseType.short_text ||
                  question.response === ResponseType.long_text) && (
                  <Field className="max-w-xs" data-invalid={!!answerError}>
                    <FieldLabel htmlFor={`max_char_limit_${index}`}>
                      Maximum characters (optional)
                    </FieldLabel>
                    <Input
                      id={`max_char_limit_${index}`}
                      type="number"
                      min="1"
                      step="1"
                      aria-invalid={!!answerError}
                      aria-describedby={answerError ? `answer_${index}_error` : undefined}
                      value={question.max_char_limit}
                      placeholder={
                        question.response === ResponseType.short_text
                          ? "255"
                          : "5000"
                      }
                      onChange={(event) =>
                        onUpdate(
                          index,
                          "max_char_limit",
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value)
                        )
                      }
                    />
                    <FieldError id={`answer_${index}_error`}>{answerError}</FieldError>
                  </Field>
                )}

                {choiceTypes.has(question.response) && (
                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Options</FieldLegend>
                    <FieldGroup className="gap-2">
                      {question.response_options.map((option, optionIndex) => (
                        <div
                          key={`option-${index}-${optionIndex}`}
                          className="flex items-center gap-2"
                        >
                          <span className="w-5 text-small text-muted-foreground">
                            {question.response === ResponseType.dropdown
                              ? `${optionIndex + 1}.`
                              : question.response ===
                                  ResponseType.multiple_choice
                                ? "○"
                                : "□"}
                          </span>
                          <Input
                            value={option}
                            aria-label={`Question ${index + 1}, option ${optionIndex + 1}`}
                            aria-invalid={!!answerError}
                            aria-describedby={answerError ? `answer_${index}_error` : undefined}
                            onChange={(event) =>
                              onUpdateResponseOption(
                                index,
                                optionIndex,
                                event.target.value
                              )
                            }
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="max-sm:min-h-11 max-sm:min-w-11"
                            aria-label={`Remove option ${optionIndex + 1}`}
                            onClick={() =>
                              onRemoveResponseOption(index, optionIndex)
                            }
                          >
                            <X />
                          </Button>
                        </div>
                      ))}
                    </FieldGroup>
                    <FieldError id={`answer_${index}_error`}>{answerError}</FieldError>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-fit"
                      onClick={() => onAddResponseOption(index)}
                    >
                      <Plus data-icon="inline-start" />
                      Add Option
                    </Button>
                  </FieldSet>
                )}

                </>}
                {question.response === ResponseType.file_upload && (
                  <FieldDescription>
                    Applicants upload one PDF, up to{" "}
                    {APPLICATION_FILE_MAX_BYTES / (1024 * 1024)} MB.
                  </FieldDescription>
                )}
                </CardContent>
              </Card>
            );
          })}

          {!locked && <Card className="bg-section py-5"><CardContent className="space-y-3 px-5"><p className="text-body-medium">Add a question</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {questionTypes.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-start sm:min-h-10"
                  onClick={() => onAdd(value)}
                >
                  <Icon data-icon="inline-start" />
                  {label}
                </Button>
              ))}
            </div>
          </CardContent></Card>}
        </FieldGroup>
      )}
    </FieldSet></CardContent></Card>
  );
}
