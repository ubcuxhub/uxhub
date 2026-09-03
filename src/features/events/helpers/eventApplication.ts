import type { EventApplicationQuestionRow } from "@/types/models";
import type { EventApplicationSubmissionResponse } from "@/lib/supabase-helpers/event-applications";

/**
 * Prepares response data for the atomic application submission RPC.
 */
export function prepareResponseData(
  questionRecords: Pick<EventApplicationQuestionRow, "id">[],
  responses: Record<string, string | string[]>
): EventApplicationSubmissionResponse[] {
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

    const responseData: EventApplicationSubmissionResponse = {
      question_id: questionRecord.id,
      response: responseText,
    };

    return responseData;
  });
}
