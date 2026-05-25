import {
  ResponseType,
  type EventInsert,
  type EventRow,
  type EventUpdate,
  type ResponseType as ResponseTypeValue,
} from "@/types/models";

export { ResponseType };
export type { EventInsert, EventRow, EventUpdate };

export interface EventApplication {
  eventId: string;
  userId: string;
  createdAt: string;
  responses: ApplicationQuestionResponse[];
}

export interface ApplicationQuestionResponse {
  question: string;
  answer: string;
}

export interface ApplicationQuestionTemplate {
  question: string;
  response: ResponseTypeValue;
  max_char_limit: number;
  response_options?: string[];
}
