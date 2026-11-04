import type {
  EventApplicationQuestionRow,
  EventApplicationResponseInsert,
} from "@/lib/supabase/models";

/**
 * Prepares response data for upsert into event_application_responses
 */
export function prepareResponseData(
  questionRecords: Pick<EventApplicationQuestionRow, "id">[],
  responses: Record<string, string | string[]>,
  applicationId: string
): EventApplicationResponseInsert[] {
  if (!applicationId) {
    throw new Error("Application ID is required to save application responses");
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
      application_id: applicationId,
      response: responseText,
    };

    return responseData;
  });
}
