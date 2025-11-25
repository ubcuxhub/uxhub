export interface Event {
  event_time: string;
  event_date: string;
  name: string;
  location_building: string;
  location_room: string;
  location_address_url: string;
  price: number;
  check_in_events: CheckInEvent[];
  description: string;
  application_template?: ApplicationQuestionTemplate[];
  created_at: string;
  max_capacity: string;
  image_url: string;
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
  location: string;
  date: string;
  time: string;
}
