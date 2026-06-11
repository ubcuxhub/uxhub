"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureUserInfo } from "@/lib/supabase-helpers/users";
import {
  createEventRegistration,
  fetchUserRegistrationId,
} from "@/lib/supabase-helpers/event-registrations";
import {
  fetchApplicationQuestionIds,
  fetchAnsweredQuestionIds,
  insertApplicationResponses,
  updateApplicationResponse,
} from "@/lib/supabase-helpers/event-applications";
import { prepareResponseData } from "../helpers/eventApplication";
import type { UserInfoRow } from "@/features/auth";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

interface UseEventApplicationResult {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
  submitApplication: (
    eventId: string,
    responses: Record<string, string | string[]>,
    user: UserInfoRow | null,
    existingRegistrationId: string | null,
    onSuccess?: () => void
  ) => Promise<void>;
  clearMessages: () => void;
}

export function useEventApplication(
  refreshUser: () => Promise<void>
): UseEventApplicationResult {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const submitApplication = async (
    eventId: string,
    responses: Record<string, string | string[]>,
    user: UserInfoRow | null,
    existingRegistrationId: string | null,
    onSuccess?: () => void
  ) => {
    if (isSubmitting) return;

    clearMessages();
    setIsSubmitting(true);

    try {
      // Get auth session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error("You must be logged in to apply for events.");
      }

      // Ensure user_info exists and get userId
      const userId = await ensureUserInfo(supabase, session.user.id, user);

      // Check if user already has a registration
      const existingRegId = await fetchUserRegistrationId(
        supabase,
        eventId,
        userId
      );

      let regId = existingRegId || existingRegistrationId;

      // Create or get registration - this MUST exist before saving responses
      if (!regId) {
        try {
          regId = await createEventRegistration(supabase, {
            event_id: eventId,
            user_id: userId,
            status: "pending",
          });
        } catch (regError) {
          if (isUniqueViolation(regError)) {
            // Unique constraint violation - fetch the existing registration
            const existingRegAfterError = await fetchUserRegistrationId(
              supabase,
              eventId,
              userId
            );

            if (!existingRegAfterError) {
              throw new Error(
                "You have already registered for this event, but we couldn't retrieve your registration."
              );
            }
            regId = existingRegAfterError;
          } else {
            const message =
              regError instanceof Error ? regError.message : "Unknown error";
            throw new Error(`Failed to create registration: ${message}`);
          }
        }
      }

      // Validate that we have a registration ID before proceeding
      if (!regId) {
        throw new Error(
          "Failed to create or retrieve event registration. Please try again."
        );
      }

      // Get question IDs in order
      const questionRecords = await fetchApplicationQuestionIds(
        supabase,
        eventId
      );

      if (questionRecords.length === 0) {
        throw new Error("No questions found for this event");
      }

      // Prepare responses to upsert
      const responsesToUpsert = prepareResponseData(
        questionRecords,
        responses,
        regId
      );

      // Validate all responses have required IDs before upserting
      const invalidResponsesToUpsert = responsesToUpsert.filter(
        (r) => !r.event_registration_id || !r.event_application_question_id
      );
      if (invalidResponsesToUpsert.length > 0) {
        throw new Error(
          `Cannot save responses: ${invalidResponsesToUpsert.length} response(s) missing registration ID or question ID`
        );
      }

      // Fetch existing responses for this registration
      let existingQuestionIds = new Set<string>();
      try {
        const answeredQuestionIds = await fetchAnsweredQuestionIds(
          supabase,
          regId
        );
        existingQuestionIds = new Set(answeredQuestionIds);
      } catch (fetchExistingError) {
        console.warn(
          "Warning: Could not fetch existing responses:",
          fetchExistingError
        );
      }

      // Separate responses into updates and inserts
      const responsesToUpdate = responsesToUpsert.filter((r) =>
        existingQuestionIds.has(r.event_application_question_id as string)
      );
      const responsesToInsert = responsesToUpsert.filter(
        (r) =>
          !existingQuestionIds.has(r.event_application_question_id as string)
      );

      // Update existing responses
      if (responsesToUpdate.length > 0) {
        for (const response of responsesToUpdate) {
          try {
            await updateApplicationResponse(
              supabase,
              regId,
              response.event_application_question_id as string,
              response.response ?? ""
            );
          } catch (updateError) {
            const message =
              updateError instanceof Error
                ? updateError.message
                : "Unknown error";
            throw new Error(`Failed to update response: ${message}`);
          }
        }
      }

      // Insert new responses
      if (responsesToInsert.length > 0) {
        let insertedCount = 0;
        try {
          insertedCount = await insertApplicationResponses(
            supabase,
            responsesToInsert
          );
        } catch (insertError) {
          const message =
            insertError instanceof Error
              ? insertError.message
              : "Unknown error";
          throw new Error(`Failed to insert responses: ${message}`);
        }

        if (insertedCount === 0) {
          throw new Error("Responses were not inserted. Please try again.");
        }
      }

      setSuccessMessage("Application submitted successfully!");

      // Refresh user context in background
      refreshUser().catch((err) => {
        console.warn("Failed to refresh user context:", err);
      });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/portal");
      }, 2000);
    } catch (err) {
      console.error("Error submitting application:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to submit application";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    error,
    successMessage,
    submitApplication,
    clearMessages,
  };
}
