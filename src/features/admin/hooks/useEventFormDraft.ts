"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { ApplicationQuestionTemplate } from "@/features/events/types/eventTypes";
import type { CheckInSessionDraft } from "@/features/admin/types/checkInTypes";
import {
  getInitialFormState,
  type EventFormState,
} from "../components/event-form/event-form-schema";

const EVENT_FORM_STORAGE_KEY = "event_create_form_draft";

interface UseEventFormDraftOptions {
  eventId?: string;
  formState: EventFormState;
  checkInEvents: CheckInSessionDraft[];
  applicationTemplate: ApplicationQuestionTemplate[];
  setFormState: Dispatch<SetStateAction<EventFormState>>;
  setCheckInEvents: Dispatch<SetStateAction<CheckInSessionDraft[]>>;
  setApplicationTemplate: Dispatch<
    SetStateAction<ApplicationQuestionTemplate[]>
  >;
}

export function useEventFormDraft({
  eventId,
  formState,
  checkInEvents,
  applicationTemplate,
  setFormState,
  setCheckInEvents,
  setApplicationTemplate,
}: UseEventFormDraftOptions) {
  const restored = useRef(false);

  useEffect(() => {
    if (eventId) {
      localStorage.removeItem(EVENT_FORM_STORAGE_KEY);
      restored.current = true;
      return;
    }

    try {
      const saved = localStorage.getItem(EVENT_FORM_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        queueMicrotask(() => {
          setFormState({
            ...getInitialFormState(),
            ...parsed.formState,
          });
          setCheckInEvents(
            parsed.checkInEvents ?? [
              { name: "", start_time: "", end_time: "" },
            ]
          );
          setApplicationTemplate(parsed.applicationTemplate ?? []);
        });
      }
    } catch {
      localStorage.removeItem(EVENT_FORM_STORAGE_KEY);
    } finally {
      restored.current = true;
    }
  }, [
    eventId,
    setApplicationTemplate,
    setCheckInEvents,
    setFormState,
  ]);

  useEffect(() => {
    if (eventId || !restored.current) return;
    localStorage.setItem(
      EVENT_FORM_STORAGE_KEY,
      JSON.stringify({ formState, checkInEvents, applicationTemplate })
    );
  }, [applicationTemplate, checkInEvents, eventId, formState]);

  return {
    clearDraft: () => localStorage.removeItem(EVENT_FORM_STORAGE_KEY),
  };
}
