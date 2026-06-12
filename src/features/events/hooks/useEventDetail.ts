"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchApplicationQuestions } from "@/lib/supabase-helpers/event-applications";
import { fetchUserRegistrationId } from "@/lib/supabase-helpers/event-registrations";
import {
  ResponseType,
  type EventRow,
  type ApplicationQuestionTemplate,
} from "../types/eventTypes";
import type { UserInfoRow } from "@/features/auth";

interface UseEventDetailResult {
  event: EventRow | null;
  questions: ApplicationQuestionTemplate[];
  loading: boolean;
  error: string | null;
  hasApplied: boolean;
  registrationId: string | null;
}

export function useEventDetail(
  eventSlug: string | undefined,
  user: UserInfoRow | null,
  userLoading: boolean
): UseEventDetailResult {
  const supabase = useMemo(() => createClient(), []);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [questions, setQuestions] = useState<ApplicationQuestionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventSlug || userLoading) return;

    const fetchEventData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch event
        const eventData = await fetchEventBySlug(supabase, eventSlug);

        if (!eventData) {
          setError("Event not found");
          setLoading(false);
          return;
        }

        setEvent(eventData);

        // Fetch application questions
        try {
          const questionsData = await fetchApplicationQuestions(
            supabase,
            eventData.id
          );
          if (questionsData.length > 0) {
            const formattedQuestions: ApplicationQuestionTemplate[] =
              questionsData.map((q) => ({
                question: q.question ?? "",
                response:
                  (q.response_type as ResponseType) ?? ResponseType.text,
                max_char_limit: q.max_char_limit ?? 0,
                response_options: q.response_options ?? [],
              }));
            setQuestions(formattedQuestions);
          } else {
            setQuestions([]);
          }
        } catch (questionsError) {
          console.error("Error fetching questions:", questionsError);
          setQuestions([]);
        }

        // Check if user has already applied
        if (user?.id) {
          try {
            const existingRegistrationId = await fetchUserRegistrationId(
              supabase,
              eventData.id,
              user.id
            );
            if (existingRegistrationId) {
              setHasApplied(true);
              setRegistrationId(existingRegistrationId);
            }
          } catch (registrationError) {
            console.error("Error checking registration:", registrationError);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching event data:", err);
        setError("Failed to load event data");
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventSlug, user?.id, userLoading, supabase]);

  return {
    event,
    questions,
    loading,
    error,
    hasApplied,
    registrationId,
  };
}
