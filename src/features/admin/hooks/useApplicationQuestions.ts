"use client";

import { useState } from "react";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types/eventTypes";

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
    value: string | ResponseType | number | string[]
  ) => {
    resetSuccessMessage();
    if (
      field === "question" ||
      field === "max_char_limit" ||
      field === "response_options"
    )
      clearError(index);
    setApplicationTemplate((current) =>
      current.map((question, itemIndex) =>
        itemIndex === index
          ? {
              ...question,
              [field]:
                field === "max_char_limit"
                  ? value === ""
                    ? ""
                    : Number(value)
                  : field === "response_options"
                    ? (value as string[])
                    : (value as string | ResponseType),
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

  const addApplicationQuestion = () => {
    resetSuccessMessage();
    setApplicationTemplate((current) => [
      ...current,
      {
        question: "",
        response: ResponseType.text,
        max_char_limit: "",
        response_options: [],
      },
    ]);
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
              ...(response === ResponseType.multi_select ||
              response === ResponseType.single_select
                ? { response_options: question.response_options || [] }
                : {}),
              ...(response === ResponseType.text && !question.max_char_limit
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
