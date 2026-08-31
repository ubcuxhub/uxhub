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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types/eventTypes";

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

const fileTypes = ["PNG", "JPEG", "PDF"] as const;

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
            id="applications_enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <FieldLabel htmlFor="applications_enabled">Enabled</FieldLabel>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    aria-label={`Remove question ${index + 1}`}
                    onClick={() => onRemove(index)}
                  >
                    <X />
                  </Button>
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
                  <FieldGroup className="gap-4">
                    <FieldDescription>
                      File responses are configurable now, but uploading and
                      downloading files will be implemented separately.
                    </FieldDescription>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`restrict_file_types_${index}`}
                        checked={question.restrict_file_types}
                        onCheckedChange={(checked) =>
                          onUpdate(index, "restrict_file_types", checked)
                        }
                      />
                      <FieldLabel htmlFor={`restrict_file_types_${index}`}>
                        Allow only specific file types
                      </FieldLabel>
                    </div>
                    {question.restrict_file_types && (
                      <div className="flex flex-wrap gap-4">
                        {fileTypes.map((fileType) => (
                          <div key={fileType} className="flex items-center gap-2">
                            <Checkbox
                              id={`file_type_${index}_${fileType}`}
                              checked={question.allowed_file_types.includes(
                                fileType.toLowerCase()
                              )}
                              onCheckedChange={(checked) =>
                                onUpdate(
                                  index,
                                  "allowed_file_types",
                                  checked
                                    ? [
                                        ...question.allowed_file_types,
                                        fileType.toLowerCase(),
                                      ]
                                    : question.allowed_file_types.filter(
                                        (value) =>
                                          value !== fileType.toLowerCase()
                                      )
                                )
                              }
                            />
                            <FieldLabel
                              htmlFor={`file_type_${index}_${fileType}`}
                            >
                              {fileType}
                            </FieldLabel>
                          </div>
                        ))}
                      </div>
                    )}
                    <Field className="max-w-xs">
                      <FieldLabel>Maximum File Size</FieldLabel>
                      <Select
                        value={String(question.max_file_size_bytes || 10_485_760)}
                        onValueChange={(value) =>
                          onUpdate(
                            index,
                            "max_file_size_bytes",
                            Number(value)
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="5242880">5 MB</SelectItem>
                            <SelectItem value="10485760">10 MB</SelectItem>
                            <SelectItem value="26214400">25 MB</SelectItem>
                            <SelectItem value="52428800">50 MB</SelectItem>
                            <SelectItem value="104857600">100 MB</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
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
