import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/types/membershipTypes";

const supabase = createClient();

/**
 * Ensures user_info record exists, creating it if necessary
 */
export async function ensureUserInfo(
  sessionUserId: string,
  user: User | null
): Promise<string> {
  // Check if user_info exists
  const { data: existingUserInfo, error: fetchError } = await supabase
    .from("user_info")
    .select("auth_user_id")
    .eq("auth_user_id", sessionUserId)
    .maybeSingle();

  // Handle errors - PGRST116 means no rows found, which is fine
  if (fetchError) {
    const errorCode = "code" in fetchError ? fetchError.code : undefined;
    const errorMessage = fetchError.message || "";

    // PGRST116 is "no rows returned" - this is expected if user_info doesn't exist yet
    if (errorCode !== "PGRST116" && !errorMessage.includes("No rows")) {
      throw new Error(`Failed to load user information: ${errorMessage}`);
    }
  }

  // If user_info exists, return the auth_user_id
  if (existingUserInfo?.auth_user_id) {
    return existingUserInfo.auth_user_id;
  }

  // Create user_info if it doesn't exist
  const email = user?.email || "";
  if (!email) {
    throw new Error(
      "Email is required. Please ensure you're logged in with an email address."
    );
  }

  const { data: newUserInfo, error: createError } = await supabase
    .from("user_info")
    .insert({
      email: email,
      name: user?.name || email.split("@")[0] || "User",
      auth_user_id: sessionUserId,
      membership_type: "NonUbc",
      role_access: "basic",
    })
    .select("auth_user_id")
    .single();

  if (createError) {
    // If user already exists (unique constraint), that's fine - use session user id
    if (createError.code === "23505") {
      return sessionUserId;
    }
    throw new Error(`Failed to set up your profile: ${createError.message}`);
  }

  return newUserInfo?.auth_user_id || sessionUserId;
}

/**
 * Prepares response data for insertion into event_application_responses
 */
export function prepareResponseData(
  questionRecords: Array<{ id: string; question: string }>,
  responses: Record<string, string | string[]>,
  registrationId: string,
  applicationId: string
): Array<Record<string, unknown>> {
  // Validate registration ID is provided
  if (!registrationId) {
    throw new Error("Registration ID is required to save application responses");
  }

  // Validate application ID is provided
  if (!applicationId) {
    throw new Error("Application ID is required to save application responses");
  }

  return questionRecords.map((questionRecord, index) => {
    const questionId = `question_${index}`;
    const responseValue = responses[questionId];

    // Convert response to string format for 'response' column
    let responseText: string;
    if (Array.isArray(responseValue)) {
      responseText = responseValue.join(", ");
    } else {
      responseText = responseValue || "";
    }

    // Build response data
    const responseData: Record<string, unknown> = {
      event_application_question_id: questionRecord.id,
      event_registration_id: registrationId,
      application_id: applicationId, // Link to event_applications table
      question: questionRecord.question || "",
      response: responseText,
    };

    // Handle 'answer' column - it's JSON type
    if (Array.isArray(responseValue)) {
      responseData.answer = responseValue; // JSON array
    } else {
      responseData.answer = responseText; // JSON string
    }

    return responseData;
  });
}

