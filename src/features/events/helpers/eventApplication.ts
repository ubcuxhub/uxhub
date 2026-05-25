import type {
  EventApplicationQuestionRow,
  EventApplicationResponseInsert,
} from "@/types/models";

/**
 * Prepares response data for upsert into event_application_responses
 */
export function prepareResponseData(
  questionRecords: Pick<EventApplicationQuestionRow, "id">[],
  responses: Record<string, string | string[]>,
  registrationId: string
): EventApplicationResponseInsert[] {
  if (!registrationId) {
    throw new Error(
      "Registration ID is required to save application responses"
    );
  }

  return questionRecords.map((questionRecord, index) => {
    const questionId = `question_${index}`;
    const responseValue = responses[questionId];

    // Arrays (multi_select) are converted to comma-separated strings
    let responseText: string;
    if (Array.isArray(responseValue)) {
      responseText = responseValue.join(", ");
    } else {
      responseText = responseValue || "";
    }

    const responseData: EventApplicationResponseInsert = {
      event_application_question_id: questionRecord.id,
      event_registration_id: registrationId,
      response: responseText,
    };

    return responseData;
  });
}
