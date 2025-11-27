import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Event, ApplicationQuestionTemplate } from "@/lib/types/eventTypes";
import { ResponseType } from "@/lib/types/eventTypes";
import type { User } from "@/lib/types/membershipTypes";

type EventRecord = Event & { id: string };

interface UseEventDetailResult {
  event: EventRecord | null;
  questions: ApplicationQuestionTemplate[];
  loading: boolean;
  error: string | null;
  hasApplied: boolean;
  registrationId: string | null;
}

export function useEventDetail(
  eventId: string | undefined,
  user: User | null,
  userLoading: boolean
): UseEventDetailResult {
  const supabase = useMemo(() => createClient(), []);
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [questions, setQuestions] = useState<ApplicationQuestionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || userLoading) return;

    const fetchEventData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch event
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", eventId)
          .maybeSingle();

        if (eventError) {
          setError(eventError.message);
          setLoading(false);
          return;
        }

        if (!eventData) {
          setError("Event not found");
          setLoading(false);
          return;
        }

        setEvent(eventData as EventRecord);

        // Fetch application questions
        const { data: questionsData, error: questionsError } = await supabase
          .from("event_application_questions")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (questionsError) {
          console.error("Error fetching questions:", questionsError);
          setQuestions([]);
        } else if (questionsData && questionsData.length > 0) {
          const formattedQuestions: ApplicationQuestionTemplate[] =
            questionsData.map((q) => ({
              question: q.question ?? "",
              response: (q.response as ResponseType) ?? ResponseType.text,
              max_char_limit: q.max_char_limit ?? 0,
              response_options: q.response_options ?? [],
            }));
          setQuestions(formattedQuestions);
        } else {
          setQuestions([]);
        }

        // Check if user has already applied
        if (user?.auth_user_id) {
          const { data: registrationData, error: registrationError } =
            await supabase
              .from("event_registrations")
              .select("id")
              .eq("event_id", eventId)
              .eq("user_id", user.auth_user_id)
              .maybeSingle();

          if (registrationError) {
            console.error("Error checking registration:", registrationError);
          } else if (registrationData) {
            setHasApplied(true);
            setRegistrationId(registrationData.id);
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
  }, [eventId, user?.auth_user_id, userLoading, supabase]);

  return {
    event,
    questions,
    loading,
    error,
    hasApplied,
    registrationId,
  };
}

