import {
  ResponseType,
  type ResponseType as ResponseTypeValue,
} from "@/types/models";

export { ResponseType };

export interface ApplicationQuestionTemplate {
  question: string;
  response: ResponseTypeValue;
  max_char_limit: number | "";
  response_options?: string[];
}
