"use client";

import { useState } from "react";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types/eventTypes";

const isChoiceType = (response: ResponseType) =>
  response === ResponseType.checkbox ||
  response === ResponseType.multiple_choice ||
  response === ResponseType.dropdown;

const createQuestion = (
  response: ResponseType
): ApplicationQuestionTemplate => ({
  question: "",
  description: "",
  response,
  is_required: false,
  max_char_limit: "",
  response_options: isChoiceType(response) ? [""] : [],
  restrict_file_types: false,
  allowed_file_types: [],
  max_file_size_bytes: response === ResponseType.file_upload ? 10_485_760 : "",
});

export function useApplicationQuestions(
  resetSuccessMessage: () => void,
  initial: ApplicationQuestionTemplate[] = []
) {
  const [applicationTemplate, setApplicationTemplate] =
    useState<ApplicationQuestionTemplate[]>(initial);
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>(
    {}
  );

  const clearError = (index: number) =>
    setQuestionErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });

  const updateApplicationQuestion = (
    index: number,
    field: keyof ApplicationQuestionTemplate,
    value: string | ResponseType | number | boolean | string[]
  ) => {
    resetSuccessMessage();
    if (
      field === "question" ||
      field === "description" ||
      field === "max_char_limit" ||
      field === "response_options" ||
      field === "allowed_file_types" ||
      field === "max_file_size_bytes"
    )
      clearError(index);
    setApplicationTemplate((current) =>
      current.map((question, itemIndex) =>
        itemIndex === index
          ? {
              ...question,
              [field]:
                field === "max_char_limit" || field === "max_file_size_bytes"
                  ? value === ""
                    ? ""
                    : Number(value)
                  : field === "response_options" ||
                      field === "allowed_file_types"
                    ? (value as string[])
                    : value,
            }
          : question
      )
    );
  };

  const addResponseOption = (index: number) => {
    resetSuccessMessage();
    setApplicationTemplate((current) =>
      current.map((question, itemIndex) =>
        itemIndex === index
          ? {
              ...question,
              response_options: [...(question.response_options || []), ""],
            }
          : question
      )
    );
  };

  const updateResponseOption = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    resetSuccessMessage();
    setApplicationTemplate((current) =>
      current.map((question, itemIndex) =>
        itemIndex === questionIndex
          ? {
              ...question,
              response_options: (question.response_options || []).map(
                (option, index) => (index === optionIndex ? value : option)
              ),
            }
          : question
      )
    );
  };

  const removeResponseOption = (questionIndex: number, optionIndex: number) => {
    resetSuccessMessage();
    setApplicationTemplate((current) =>
      current.map((question, itemIndex) =>
        itemIndex === questionIndex
          ? {
              ...question,
              response_options: (question.response_options || []).filter(
                (_, index) => index !== optionIndex
              ),
            }
          : question
      )
    );
  };

  const addApplicationQuestion = (response: ResponseType) => {
    resetSuccessMessage();
    setApplicationTemplate((current) => [...current, createQuestion(response)]);
  };

  const removeApplicationQuestion = (index: number) => {
    resetSuccessMessage();
    setApplicationTemplate((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const handleResponseTypeChange = (
    index: number,
    response: ResponseType
  ) => {
    resetSuccessMessage();
    clearError(index);
    setApplicationTemplate((current) =>
      current.map((question, itemIndex) =>
        itemIndex === index
          ? {
              ...question,
              response,
              ...(isChoiceType(response)
                ? { response_options: question.response_options || [] }
                : {}),
              ...((response === ResponseType.short_text ||
                response === ResponseType.long_text) &&
              !question.max_char_limit
                ? { max_char_limit: "" }
                : {}),
            }
          : question
      )
    );
  };

  return {
    applicationTemplate,
    setApplicationTemplate,
    questionErrors,
    setQuestionErrors,
    updateApplicationQuestion,
    addResponseOption,
    updateResponseOption,
    removeResponseOption,
    addApplicationQuestion,
    removeApplicationQuestion,
    handleResponseTypeChange,
  };
}
