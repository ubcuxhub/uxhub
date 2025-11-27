import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureUserInfo, prepareResponseData } from "@/lib/utils/eventApplication";
import type { User } from "@/lib/types/membershipTypes";

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
            accepted: false,
            attending: false,
            checked_in: false,
          })
          .select("id")
          .single();

        if (regError) {
          if (regError.code === "23505") {
            // If unique constraint violation, try to fetch the existing registration
            const { data: existingRegAfterError, error: fetchError } = await supabase
              .from("event_registrations")
              .select("id")
              .eq("event_id", eventId)
              .eq("user_id", userId)
              .maybeSingle();

            if (fetchError || !existingRegAfterError) {
              throw new Error("You have already registered for this event, but we couldn't retrieve your registration.");
            }
            regId = existingRegAfterError.id;
          } else {
            throw new Error(`Failed to create registration: ${regError.message}`);
          }
        } else if (newRegistration?.id) {
          regId = newRegistration.id;
        }
      }

      // Validate that we have a registration ID before proceeding
      if (!regId) {
        throw new Error("Failed to create or retrieve event registration. Please try again.");
      }

      // Create or get event_application record
      let applicationId: string | null = null;

      // Check if application already exists for this registration
      const { data: existingApplication, error: appCheckError } = await supabase
        .from("event_applications")
        .select("id")
        .eq("event_registration_id", regId)
        .maybeSingle();

      if (appCheckError && appCheckError.code !== "PGRST116") {
        console.warn("Warning: Could not check existing application:", appCheckError);
      }

      if (existingApplication?.id) {
        applicationId = existingApplication.id;
      } else {
        // Create new application record
        const { data: newApplication, error: appError } = await supabase
          .from("event_applications")
          .insert({
            event_registration_id: regId,
            status: "pending",
          })
          .select("id")
          .single();

        if (appError) {
          // If unique constraint violation, try to fetch existing
          if (appError.code === "23505") {
            const { data: existingAppAfterError, error: fetchAppError } = await supabase
              .from("event_applications")
              .select("id")
              .eq("event_registration_id", regId)
              .maybeSingle();

            if (fetchAppError || !existingAppAfterError) {
              throw new Error(`Failed to create application: ${appError.message}`);
            }
            applicationId = existingAppAfterError.id;
          } else {
            throw new Error(`Failed to create application: ${appError.message}`);
          }
        } else if (newApplication?.id) {
          applicationId = newApplication.id;
        }
      }

      if (!applicationId) {
        throw new Error("Failed to create or retrieve event application. Please try again.");
      }

      // Get question IDs and question text in order
      const { data: questionRecords, error: questionsError } = await supabase
        .from("event_application_questions")
        .select("id, question")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (questionsError) {
        throw new Error(`Failed to fetch questions: ${questionsError.message}`);
      }

      if (!questionRecords || questionRecords.length === 0) {
        throw new Error("No questions found for this event");
      }

      // Prepare responses to insert
      const responsesToInsert = prepareResponseData(
        questionRecords,
        responses,
        regId,
        applicationId
      );

      // Delete existing responses if updating (delete by both registration and application ID)
      const { error: deleteError } = await supabase
        .from("event_application_responses")
        .delete()
        .eq("event_registration_id", regId)
        .eq("application_id", applicationId);

      if (deleteError && deleteError.code !== "PGRST116") {
        console.warn("Warning: Could not delete existing responses:", deleteError);
      }

      // Validate all responses have required IDs before inserting
      const invalidResponsesToInsert = responsesToInsert.filter(
        (r) => !r.event_registration_id || !r.application_id
      );
      if (invalidResponsesToInsert.length > 0) {
        throw new Error(
          `Cannot save responses: ${invalidResponsesToInsert.length} response(s) missing registration ID or application ID`
        );
      }

      // Insert new responses
      const { data: insertedResponses, error: insertError } = await supabase
        .from("event_application_responses")
        .insert(responsesToInsert)
        .select("id, event_registration_id, application_id");

      if (insertError) {
        throw new Error(`Failed to save responses: ${insertError.message}`);
      }

      // Verify responses were saved with required IDs
      if (!insertedResponses || insertedResponses.length === 0) {
        throw new Error("Responses were not saved. Please try again.");
      }

      const invalidResponses = insertedResponses.filter(
        (r) => !r.event_registration_id || !r.application_id
      );
      if (invalidResponses.length > 0) {
        console.error(
          "Warning: Some responses were saved without registration ID or application ID:",
          invalidResponses
        );
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

