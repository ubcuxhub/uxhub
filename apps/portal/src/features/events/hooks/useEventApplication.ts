"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureUserInfo } from "@/lib/queries/user";
import { prepareResponseData } from "../helpers/eventApplication";
import type { User } from "@/features/auth";

interface UseEventApplicationResult {
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
  submitApplication: (
    eventId: string,
    responses: Record<string, string | string[]>,
    user: User | null,
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
    user: User | null,
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
      const userId = await ensureUserInfo(session.user.id, user);

      // Check if user already has a registration
      const { data: existingReg, error: checkError } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError) {
        throw new Error(
          `Failed to check existing registration: ${checkError.message}`
        );
      }

      let regId = existingReg?.id || existingRegistrationId;

      // Create or get registration - this MUST exist before saving responses
      if (!regId) {
        const { data: newRegistration, error: regError } = await supabase
          .from("event_registrations")
          .insert({
            event_id: eventId,
            user_id: userId,
            status: "pending",
          })
          .select("id")
          .single();

        if (regError) {
          if (regError.code === "23505") {
            // If unique constraint violation, try to fetch the existing registration
            const { data: existingRegAfterError, error: fetchError } =
              await supabase
                .from("event_registrations")
                .select("id")
                .eq("event_id", eventId)
                .eq("user_id", userId)
                .maybeSingle();

            if (fetchError || !existingRegAfterError) {
              throw new Error(
                "You have already registered for this event, but we couldn't retrieve your registration."
              );
            }
            regId = existingRegAfterError.id;
          } else {
            throw new Error(
              `Failed to create registration: ${regError.message}`
            );
          }
        } else if (newRegistration?.id) {
          regId = newRegistration.id;
        }
      }

      // Validate that we have a registration ID before proceeding
      if (!regId) {
        throw new Error(
          "Failed to create or retrieve event registration. Please try again."
        );
      }

      // Get question IDs in order
      const { data: questionRecords, error: questionsError } = await supabase
        .from("event_application_questions")
        .select("id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (questionsError) {
        throw new Error(`Failed to fetch questions: ${questionsError.message}`);
      }

      if (!questionRecords || questionRecords.length === 0) {
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
      const { data: existingResponses, error: fetchExistingError } =
        await supabase
          .from("event_application_responses")
          .select("event_application_question_id")
          .eq("event_registration_id", regId);

      if (fetchExistingError && fetchExistingError.code !== "PGRST116") {
        console.warn(
          "Warning: Could not fetch existing responses:",
          fetchExistingError
        );
      }

      const existingQuestionIds = new Set(
        (existingResponses || []).map((r) => r.event_application_question_id)
      );

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
          const { error: updateError } = await supabase
            .from("event_application_responses")
            .update({ response: response.response })
            .eq("event_registration_id", regId)
            .eq(
              "event_application_question_id",
              response.event_application_question_id
            );

          if (updateError) {
            throw new Error(
              `Failed to update response: ${updateError.message}`
            );
          }
        }
      }

      // Insert new responses
      if (responsesToInsert.length > 0) {
        const { data: insertedResponses, error: insertError } = await supabase
          .from("event_application_responses")
          .insert(responsesToInsert)
          .select("id, event_registration_id, event_application_question_id");

        if (insertError) {
          throw new Error(`Failed to insert responses: ${insertError.message}`);
        }

        if (!insertedResponses || insertedResponses.length === 0) {
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
        router.push("/events");
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
