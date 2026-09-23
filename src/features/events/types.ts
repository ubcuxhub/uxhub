import {
  ResponseType,
  type ApplicationStatus,
  type ResponseType as ResponseTypeValue,
} from "@/lib/supabase/models";

export { ResponseType };

export interface ApplicationQuestionTemplate {
  question: string;
  description: string;
  response: ResponseTypeValue;
  is_required: boolean;
  max_char_limit: number | "";
  response_options: string[];
  restrict_file_types: boolean;
  allowed_file_types: string[];
  max_file_size_bytes: number | "";
}

export interface GroupedRegistration {
  user_id: string;
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
  registrationId: string;
}
