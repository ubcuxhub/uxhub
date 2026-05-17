"use client";

import { useState, useEffect, useRef, useMemo, startTransition } from "react";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface EventApplicationFormProps {
  eventId: string;
  questions: ApplicationQuestionTemplate[];
  onSubmit: (responses: Record<string, string | string[]>) => Promise<void>;
  isSubmitting?: boolean;
  existingResponses?: Record<string, string | string[]>;
}

export const EventApplicationForm = ({
  questions,
  onSubmit,
  isSubmitting = false,
  existingResponses,
}: EventApplicationFormProps) => {
  // Create a stable key from existingResponses to detect changes
  const responsesKey = useMemo(
    () => JSON.stringify(existingResponses || {}),
    [existingResponses]
  );

  // Initialize responses from existingResponses if provided
  const [responses, setResponses] = useState<
    Record<string, string | string[]>
  >(() => existingResponses || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const prevKeyRef = useRef<string>(responsesKey);

  // Update responses when existingResponses prop changes
  // Using startTransition to make state updates non-blocking
  useEffect(() => {
    if (existingResponses && responsesKey !== prevKeyRef.current) {
      prevKeyRef.current = responsesKey;
      startTransition(() => {
        setResponses(existingResponses);
        setErrors({});
      });
    }
  }, [existingResponses, responsesKey]);

  const handleTextChange = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    // Clear error when user starts typing
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const handleMultiSelectChange = (
    questionId: string,
    option: string,
    checked: boolean
  ) => {
    setResponses((prev) => {
      const current = (prev[questionId] as string[]) || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, option] };
      } else {
        return {
          ...prev,
          [questionId]: current.filter((item) => item !== option),
        };
      }
    });
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    questions.forEach((question, index) => {
      const questionId = `question_${index}`;
      const response = responses[questionId];

      if (!response || (typeof response === "string" && !response.trim())) {
        newErrors[questionId] = "This field is required";
        return;
      }

      if (question.response === ResponseType.text) {
        const textResponse = response as string;
        if (
          question.max_char_limit > 0 &&
          textResponse.length > question.max_char_limit
        ) {
          newErrors[questionId] = `Response must be ${question.max_char_limit} characters or less`;
        }
      } else if (question.response === ResponseType.multi_select) {
        const multiResponse = response as string[];
        if (multiResponse.length === 0) {
          newErrors[questionId] = "Please select at least one option";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    // Validate form
    if (!validateForm()) {
      // Scroll to first error after a brief delay to ensure DOM is updated
      setTimeout(() => {
        const firstErrorId = Object.keys(errors)[0];
        if (firstErrorId) {
          const element = document.getElementById(firstErrorId);
          element?.scrollIntoView({ behavior: "smooth", block: "center" });
          element?.focus();
        }
      }, 100);
      return;
    }

    // Submit form - parent handles success/error states
    await onSubmit(responses);
  };

  if (questions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Form</CardTitle>
        <CardDescription>
          Please answer the following questions to apply for this event.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {questions.map((question, index) => {
            const questionId = `question_${index}`;
            const response = responses[questionId];
            const error = errors[questionId];

            return (
              <div key={questionId} className="space-y-2">
                <Label htmlFor={questionId}>
                  {question.question}
                  <span className="text-red-500 ml-1">*</span>
                </Label>

                {question.response === ResponseType.text && (
                  <div className="space-y-1">
                    <textarea
                      id={questionId}
                      value={(response as string) || ""}
                      onChange={(e) =>
                        handleTextChange(questionId, e.target.value)
                      }
                      maxLength={question.max_char_limit || undefined}
                      className={`min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                        error
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }`}
                      required
                    />
                    {question.max_char_limit > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {(response as string)?.length || 0} /{" "}
                        {question.max_char_limit} characters
                      </p>
                    )}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                  </div>
                )}

                {question.response === ResponseType.single_select && (
                  <div className="space-y-1">
                    <Select
                      value={(response as string) || ""}
                      onValueChange={(value: string) =>
                        handleSelectChange(questionId, value)
                      }
                      required
                    >
                      <SelectTrigger
                        className={error ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {question.response_options?.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                  </div>
                )}

                {question.response === ResponseType.multi_select && (
                  <div className="space-y-2">
                    <div className="space-y-2 rounded-md border p-3">
                      {question.response_options?.map((option) => {
                        const isChecked = (
                          (response as string[]) || []
                        ).includes(option);
                        return (
                          <div
                            key={option}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`${questionId}_${option}`}
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                handleMultiSelectChange(
                                  questionId,
                                  option,
                                  checked === true
                                )
                              }
                            />
                            <Label
                              htmlFor={`${questionId}_${option}`}
                              className="font-normal cursor-pointer"
                            >
                              {option}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
