export interface Event {
  id: string; // uuid - primary key
  name: string; // text - required
  description: string; // text - required
  regular_price: number; // numeric - required
  member_price: number; // numeric - required
  location_building?: string | null; // text - optional
  location_room?: string | null; // text - optional
  location_address_url?: string | null; // text - optional
  start_date?: string | null; // date - optional
  start_time?: string | null; // time - optional
  end_date?: string | null; // date - optional
  end_time?: string | null; // time - optional
  max_capacity: number; // int4 - required
  image_url?: string | null; // text - optional
  registration_start_time?: string | null; // timestamptz - optional
  registration_end_time?: string | null; // timestamptz - optional
  created_at?: string | null; // timestamptz - optional
  updated_at?: string | null; // timestamptz - optional
}

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
  response: ResponseType;
  max_char_limit: number;
  response_options?: string[];
}

export enum ResponseType {
  text = "text",
  multi_select = "multi_select",
  single_select = "single_select",
}

export interface CheckInEvent {
  name: string;
  start_time: string; // datetime-local format for UI
  end_time: string; // datetime-local format for UI
}
