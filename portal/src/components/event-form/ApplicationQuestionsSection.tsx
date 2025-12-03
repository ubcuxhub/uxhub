import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ApplicationQuestionTemplate } from "@/lib/types/eventTypes";
import { ResponseType } from "@/lib/types/eventTypes";

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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Application Questions</h3>
          <p className="text-sm text-muted-foreground">
            Define any application questions attendees must answer. (Optional)
          </p>
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
      <div className="flex flex-col gap-4">
        {applicationTemplate.map((question, index) => (
          <div
            key={`application-${index}`}
            className="grid gap-3 rounded-lg border p-4 md:grid-cols-3"
          >
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor={`question_${index}`}>
                Question <span className="text-red-500">*</span>
              </Label>
              <Input
                id={`question_${index}`}
                value={question.question}
                onChange={(e) => onUpdate(index, "question", e.target.value)}
                required
                className={
                  questionErrors[index]
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {questionErrors[index] && (
                <p className="text-sm text-red-500">{questionErrors[index]}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`response_${index}`}>Response Type</Label>
              <select
                id={`response_${index}`}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={question.response}
                onChange={(e) => {
                  const newResponseType = e.target.value as ResponseType;
                  onResponseTypeChange(index, newResponseType);
                }}
                required
              >
                {Object.values(ResponseType).map((value) => (
                  <option key={value} value={value}>
                    {value.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 md:col-span-3">
              {question.response === ResponseType.text ? (
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="grid gap-2 md:col-span-1">
                    <Label htmlFor={`max_char_limit_${index}`}>
                      Max Character Limit{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`max_char_limit_${index}`}
                      type="number"
                      min="1"
                      value={question.max_char_limit}
                      onChange={(e) =>
                        onUpdate(
                          index,
                          "max_char_limit",
                          Number(e.target.value)
                        )
                      }
                      required
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => onRemove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <Label>Response Options</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddResponseOption(index)}
                    >
                      Add Option
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(question.response_options || []).map(
                      (option, optionIndex) => (
                        <div
                          key={`option-${index}-${optionIndex}`}
                          className="flex gap-2"
                        >
                          <Input
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
                        </div>
                      )
                    )}
                    {(!question.response_options ||
                      question.response_options.length === 0) && (
                      <p className="text-sm text-muted-foreground">
                        No options added. Click &quot;Add Option&quot; to add
                        selection options.
                      </p>
                    )}
                  </div>
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
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

