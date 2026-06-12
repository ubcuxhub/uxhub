import { Button } from "@/components/ui/button";
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
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types/eventTypes";

interface ApplicationQuestionsSectionProps {
  applicationTemplate: ApplicationQuestionTemplate[];
  questionErrors: Record<number, string>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof ApplicationQuestionTemplate,
    value: string | ResponseType | number | string[]
  ) => void;
  onAddResponseOption: (index: number) => void;
  onUpdateResponseOption: (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => void;
  onRemoveResponseOption: (questionIndex: number, optionIndex: number) => void;
  onResponseTypeChange: (index: number, newResponseType: ResponseType) => void;
}

export const ApplicationQuestionsSection = ({
  applicationTemplate,
  questionErrors,
  onAdd,
  onRemove,
  onUpdate,
  onAddResponseOption,
  onUpdateResponseOption,
  onRemoveResponseOption,
  onResponseTypeChange,
}: ApplicationQuestionsSectionProps) => {
  return (
    <FieldSet>
      <div className="flex items-center justify-between">
        <div>
          <FieldLegend>Application Questions</FieldLegend>
          <FieldDescription>
            Define any application questions attendees must answer. (Optional)
          </FieldDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          className="shrink-0"
        >
          Add
        </Button>
      </div>
      <FieldGroup className="gap-4">
        {applicationTemplate.map((question, index) => {
          const questionError = questionErrors[index];

          return (
            <FieldGroup
              key={`application-${index}`}
              className="grid gap-3 rounded-lg border p-4 md:grid-cols-3"
            >
              <Field
                className="md:col-span-2"
                data-invalid={questionError ? true : undefined}
              >
                <FieldLabel htmlFor={`question_${index}`}>
                  Question <span className="text-red-500">*</span>
                </FieldLabel>
                <Input
                  id={`question_${index}`}
                  value={question.question}
                  onChange={(e) => onUpdate(index, "question", e.target.value)}
                  required
                  aria-invalid={questionError ? true : undefined}
                />
                <FieldError>{questionError}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor={`response_${index}`}>
                  Response Type
                </FieldLabel>
                <Select
                  value={question.response}
                  onValueChange={(value) =>
                    onResponseTypeChange(index, value as ResponseType)
                  }
                >
                  <SelectTrigger id={`response_${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.values(ResponseType).map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <FieldGroup className="grid gap-2 md:col-span-3">
                {question.response === ResponseType.text ? (
                  <FieldGroup className="grid gap-2 md:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor={`max_char_limit_${index}`}>
                        Max Character Limit
                      </FieldLabel>
                      <Input
                        id={`max_char_limit_${index}`}
                        type="number"
                        min="1"
                        placeholder="5000"
                        value={question.max_char_limit}
                        onChange={(e) =>
                          onUpdate(
                            index,
                            "max_char_limit",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </Field>
                    <div className="flex items-end justify-end md:col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => onRemove(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </FieldGroup>
                ) : (
                  <FieldSet className="gap-3">
                    <div className="flex items-center justify-between">
                      <FieldLegend variant="label" className="mb-0">
                        Response Options
                      </FieldLegend>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAddResponseOption(index)}
                      >
                        Add Option
                      </Button>
                    </div>
                    <FieldGroup className="gap-2">
                      {(question.response_options || []).map(
                        (option, optionIndex) => (
                          <Field
                            key={`option-${index}-${optionIndex}`}
                            orientation="horizontal"
                            className="items-start gap-2"
                          >
                            <FieldLabel
                              htmlFor={`option_${index}_${optionIndex}`}
                              className="sr-only"
                            >
                              Response Option {optionIndex + 1}
                            </FieldLabel>
                            <Input
                              id={`option_${index}_${optionIndex}`}
                              value={option}
                              onChange={(e) =>
                                onUpdateResponseOption(
                                  index,
                                  optionIndex,
                                  e.target.value
                                )
                              }
                              placeholder="Enter option text"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 shrink-0"
                              onClick={() =>
                                onRemoveResponseOption(index, optionIndex)
                              }
                              disabled={
                                (question.response_options || []).length === 0
                              }
                            >
                              Remove
                            </Button>
                          </Field>
                        )
                      )}
                      {(!question.response_options ||
                        question.response_options.length === 0) && (
                        <FieldDescription>
                          No options added. Click &quot;Add Option&quot; to add
                          selection options.
                        </FieldDescription>
                      )}
                    </FieldGroup>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => onRemove(index)}
                      >
                        Remove Question
                      </Button>
                    </div>
                  </FieldSet>
                )}
              </FieldGroup>
            </FieldGroup>
          );
        })}
      </FieldGroup>
    </FieldSet>
  );
};
