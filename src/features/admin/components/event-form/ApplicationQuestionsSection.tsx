"use client";

import {
  CheckSquare,
  ChevronDown,
  CircleDot,
  FileUp,
  ListMinus,
  Plus,
  Text,
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
import { Textarea } from "@/components/ui/textarea";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types";
import { APPLICATION_FILE_MAX_BYTES } from "@/lib/supabase-helpers/application-files";

interface ApplicationQuestionsSectionProps {
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
  { value: ResponseType.short_text, label: "Short Form Question", icon: ListMinus },
  { value: ResponseType.long_text, label: "Long Form Question", icon: Text },
  { value: ResponseType.checkbox, label: "Checkboxes", icon: CheckSquare },
  {
    value: ResponseType.multiple_choice,
    label: "Multiple Choice",
    icon: CircleDot,
  },
  { value: ResponseType.file_upload, label: "File Upload", icon: FileUp },
  { value: ResponseType.dropdown, label: "Dropdown", icon: ChevronDown },
] as const;

const choiceTypes = new Set<ResponseType>([
  ResponseType.checkbox,
  ResponseType.multiple_choice,
  ResponseType.dropdown,
]);

export function ApplicationQuestionsSection({
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
  return (
    <FieldSet className="gap-5">
      <div className="flex items-center justify-between gap-4">
        <FieldLegend>Application Questions</FieldLegend>
        <div className="flex items-center gap-2">
          <Switch
            id="requires_application"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <FieldLabel htmlFor="requires_application">Enabled</FieldLabel>
        </div>
      </div>

      {enabled && (
        <FieldGroup className="gap-5">
          {applicationTemplate.map((question, index) => {
            const type = questionTypes.find(
              (option) => option.value === question.response
            );
            const questionError = questionErrors[index];
            return (
              <div
                key={`application-${index}`}
                className="relative flex flex-col gap-4 rounded-xl border bg-card p-5"
              >
                <div className="flex items-center justify-between gap-4 pr-8">
                  <h3 className="text-subheading">{type?.label}</h3>
                  <IconButton
                    variant="ghost"
                    label={`Remove question ${index + 1}`}
                    className="absolute right-2 top-2"
                    onClick={() => onRemove(index)}
                  >
                    <X />
                  </IconButton>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`question_required_${index}`}
                    checked={question.is_required}
                    onCheckedChange={(checked) =>
                      onUpdate(index, "is_required", checked)
                    }
                  />
                  <FieldLabel htmlFor={`question_required_${index}`}>
                    Required
                  </FieldLabel>
                </div>
                <Field data-invalid={questionError ? true : undefined}>
                  <FieldLabel htmlFor={`question_${index}`}>Question</FieldLabel>
                  <Input
                    id={`question_${index}`}
                    value={question.question}
                    onChange={(event) =>
                      onUpdate(index, "question", event.target.value)
                    }
                    aria-invalid={questionError ? true : undefined}
                    required
                  />
                  <FieldError>{questionError}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`question_description_${index}`}>
                    Description (Optional)
                  </FieldLabel>
                  <Textarea
                    id={`question_description_${index}`}
                    value={question.description}
                    onChange={(event) =>
                      onUpdate(index, "description", event.target.value)
                    }
                  />
                </Field>

                {(question.response === ResponseType.short_text ||
                  question.response === ResponseType.long_text) && (
                  <Field className="max-w-xs">
                    <FieldLabel htmlFor={`max_char_limit_${index}`}>
                      Maximum Characters
                    </FieldLabel>
                    <Input
                      id={`max_char_limit_${index}`}
                      type="number"
                      min="1"
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
                            aria-label={`Option ${optionIndex + 1}`}
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

                {question.response === ResponseType.file_upload && (
                  <FieldDescription>
                    Applicants upload one PDF, up to{" "}
                    {APPLICATION_FILE_MAX_BYTES / (1024 * 1024)} MB.
                  </FieldDescription>
                )}
              </div>
            );
          })}

          <div className="grid gap-5 rounded-xl border bg-muted/30 p-5 md:grid-cols-[0.7fr_1.5fr]">
            <div className="flex min-h-32 items-center justify-center">
              <Plus className="size-10" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {questionTypes.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => onAdd(value)}
                >
                  <Icon data-icon="inline-start" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </FieldGroup>
      )}
    </FieldSet>
  );
}
