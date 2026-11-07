"use client";

import { suggestedEventSlug } from "../lib/event-configuration";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import {
  deleteAdminEventAction,
  discardUnusedEventImageAction,
  saveAdminEventAction,
  saveAdminEventDraftAction,
} from "@/features/admin/actions";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types";
import { EVENT_IMAGE_ERRORS } from "@/lib/event-image";
import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
  EventUpdate,
  MentorRow,
  SponsorRow,
} from "@/lib/supabase/models";
import type { CheckInSessionDraft } from "@/features/admin/types";
import {
  createFormSnapshot,
  EMPTY_CHECK_IN_SESSION,
  getInitialFormState,
  validateEventForm,
  type EventFormState,
  type MentorDraft,
  type SponsorDraft,
} from "../components/event-form/event-form-schema";
import {
  datetimeLocalToTimestamptz,
  timestamptzToDatetimeLocal,
} from "@/lib/date";
import { useApplicationQuestions } from "./use-application-questions";
import { parseWorkingDocument, type EventWorkingDocument } from "../lib/event-working-document";
import { parseEventDescription } from "@/lib/event-description";
import type { Json } from "@/lib/supabase/database.types";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

interface UseEventFormOptions {
  eventId?: string;
  initialDraft?: { id: string; revision: number; document: EventWorkingDocument } | null;
  initialEvent?: EventRow | null;
  initialCheckInSessions?: CheckInSessionRow[];
  initialApplicationQuestions?: EventApplicationQuestionRow[];
  initialMentors?: MentorRow[];
  initialSponsors?: SponsorRow[];
  onSuccess?: (id: string) => void;
}

const LEGACY_DRAFT_KEY = "event_create_form_draft";

function formStateFromEvent(event: EventRow): EventFormState {
  return {
    configuration_initialized: true,
    marketing_mode: (event.configured_marketing_mode ?? (event.marketing_url ? "external" : "hosted")) as EventFormState["marketing_mode"],
    marketing_url: event.configured_marketing_url ?? event.marketing_url ?? "",
    page_slug: event.configured_slug ?? event.slug ?? "",
    slug_edited: event.configured_slug_edited ?? true,
    is_featured: event.is_featured,
    pricing_mode: (event.configured_pricing_mode ?? "legacy") as EventFormState["pricing_mode"],
    pricing_amount: String(event.configured_price ?? event.regular_price ?? ""),
    name: event.name ?? "",
    short_description: event.short_description ?? "",
    description: event.description ?? "",
    description_rich: parseEventDescription(event.description_rich),
    header_image_url: event.header_image_url ?? "",
    header_colour: event.header_colour ?? (event.header_image_url ? "" : "#325DC4"),
    event_colour: event.event_colour ?? "#325DC4",
    status: event.status,
    publish_at: timestamptzToDatetimeLocal(event.publish_at),
    event_type: event.event_type,
    regular_price: String(event.regular_price ?? ""),
    member_price: String(event.member_price ?? ""),
    location_building: event.location_building ?? "",
    location_room: event.location_room ?? "",
    location_address_url: event.location_address_url ?? "",
    starts_at: timestamptzToDatetimeLocal(event.starts_at),
    ends_at: timestamptzToDatetimeLocal(event.ends_at),
    max_capacity: String(event.max_capacity ?? ""),
    image_url: event.image_url ?? "",
    registration_opens_at: timestamptzToDatetimeLocal(
      event.registration_opens_at
    ),
    registration_closes_at: timestamptzToDatetimeLocal(
      event.registration_closes_at
    ),
    created_at: event.created_at ?? "",
    mentors_enabled: event.mentors_enabled,
    sponsors_enabled: event.sponsors_enabled,
    requires_application: event.requires_application,
  };
}

function questionsFromRows(
  questions: EventApplicationQuestionRow[]
): ApplicationQuestionTemplate[] {
  return questions.map((question) => ({
    question: question.question ?? "",
    description: question.description ?? "",
    response: question.response_type,
    is_required: question.is_required,
    max_char_limit: question.max_char_limit ?? "",
    response_options: question.response_options ?? [],
    restrict_file_types: question.restrict_file_types,
    allowed_file_types: question.allowed_file_types ?? [],
    max_file_size_bytes: question.max_file_size_bytes ?? "",
  }));
}

export function useEventForm({
  eventId,
  initialDraft,
  initialEvent = null,
  initialCheckInSessions = [],
  initialApplicationQuestions = [],
  initialMentors = [],
  initialSponsors = [],
  onSuccess,
}: UseEventFormOptions) {
  const router = useRouter();
  const startingFormState = useMemo(
    () => {
      const state = initialDraft?.document.formState;
      if (!state) return initialEvent ? formStateFromEvent(initialEvent) : getInitialFormState();
      // Old working documents never captured these settings. Recover them
      // from the source event instead of resetting a saved featured choice,
      // external destination or URL during an unrelated edit.
      if (state.configuration_initialized === false && initialEvent) {
        const source = formStateFromEvent(initialEvent);
        return { ...state, configuration_initialized: true,
          marketing_mode: source.marketing_mode, marketing_url: source.marketing_url,
          page_slug: source.page_slug, slug_edited: source.slug_edited,
          is_featured: source.is_featured, pricing_mode: source.pricing_mode,
          pricing_amount: source.pricing_amount };
      }
      return state;
    },
    [initialEvent, initialDraft]
  );
  const startingCheckIns = useMemo(
    () =>
      initialDraft?.document.checkInEvents ?? (initialCheckInSessions.length
        ? initialCheckInSessions.map((session) => ({
            name: session.name ?? "",
            start_time: timestamptzToDatetimeLocal(session.start_time),
            end_time: timestamptzToDatetimeLocal(session.end_time),
          }))
        : [{ ...EMPTY_CHECK_IN_SESSION }]),
    [initialCheckInSessions, initialDraft]
  );
  const startingQuestions = useMemo(
    () => initialDraft?.document.applicationTemplate ?? questionsFromRows(initialApplicationQuestions),
    [initialApplicationQuestions, initialDraft]
  );
  const [formState, setFormState] =
    useState<EventFormState>(startingFormState);
  const [checkInEvents, setCheckInEvents] =
    useState<CheckInSessionDraft[]>(startingCheckIns);
  const [mentors, setMentors] = useState<MentorDraft[]>(
    initialDraft?.document.mentors ?? initialMentors.map((mentor) => ({
      id: mentor.id,
      full_name: mentor.full_name,
      position: mentor.position ?? "",
      linkedin_url: mentor.linkedin_url ?? "",
      description: mentor.description ?? "",
      profile_image_path: mentor.profile_image_path ?? "",
    }))
  );
  const [sponsors, setSponsors] = useState<SponsorDraft[]>(
    initialDraft?.document.sponsors ?? initialSponsors.map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      brand_logo_path: sponsor.brand_logo_path ?? "",
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfigurationErrors, setShowConfigurationErrors] = useState(false);
  const [error, setError] = useState<string | null>(
    eventId && !initialEvent ? "Event not found." : null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draftId, setDraftId] = useState(() => initialDraft?.id ?? crypto.randomUUID());
  const draftRevision = useRef(initialDraft?.revision ?? 0);
  const hasSavedDraft = useRef(!!initialDraft);
  const [showDraftSaved, setShowDraftSaved] = useState(false);
  const [pendingHeaderFile, setPendingHeaderFile] = useState<File | null>(null);
  const persistedHeaderUrl = useRef(initialEvent?.header_image_url ?? null);
  const submitLock = useRef(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  // The cover image this form believes is stored, sent as the precondition for
  // each save so a stale tab cannot revert someone else's replacement.
  const persistedImageUrl = useRef<string | null>(
    initialEvent?.image_url ?? null
  );
  const bypassUnsavedChangesWarning = useRef(false);
  const [cleanSnapshot, setCleanSnapshot] = useState(() =>
    createFormSnapshot(
      startingFormState,
      startingCheckIns,
      mentors,
      sponsors,
      startingQuestions
    )
  );
  const resetSuccessMessage = () => setSuccessMessage(null);
  const questions = useApplicationQuestions(
    resetSuccessMessage,
    startingQuestions
  );
  const recoveredLegacyDraft = useRef(false);
  const [legacyDraftRecovered, setLegacyDraftRecovered] = useState(false);
  const setApplicationTemplate = questions.setApplicationTemplate;
  useEffect(() => {
    if (eventId || initialEvent || initialDraft) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(LEGACY_DRAFT_KEY);
        if (!saved) return;
        const legacy = JSON.parse(saved);
        const state = { ...getInitialFormState(), ...legacy.formState };
        if (legacy.formState?.pricing_mode === undefined) {
          state.pricing_mode = "legacy";
          state.configuration_initialized = false;
        }
        if (legacy.formState?.page_slug === undefined) state.page_slug = suggestedEventSlug(state.name);
        // Browser object URLs cannot survive a restart; the original file must
        // be selected again. Preserve the rest of the recovered document.
        const missingUpload = [state.image_url, state.header_image_url].some(url => typeof url === "string" && url.startsWith("blob:"));
        if (state.image_url?.startsWith("blob:")) state.image_url = "";
        if (state.header_image_url?.startsWith("blob:")) state.header_image_url = "";
        const document = parseWorkingDocument({ version: 1, formState: state, checkInEvents: legacy.checkInEvents ?? [{ ...EMPTY_CHECK_IN_SESSION }], mentors: legacy.mentors ?? [], sponsors: legacy.sponsors ?? [], applicationTemplate: legacy.applicationTemplate ?? [] });
        setFormState(document.formState);
        setCheckInEvents(document.checkInEvents);
        setMentors(document.mentors);
        setSponsors(document.sponsors);
        setApplicationTemplate(document.applicationTemplate);
        recoveredLegacyDraft.current = true;
        setLegacyDraftRecovered(true);
        if (missingUpload) setError("Your previous draft was recovered. Select its images again before saving.");
      } catch {
        setError("Your previous local draft could not be restored. Its browser copy has been kept.");
      }
    });
    return () => { cancelled = true; };
  }, [eventId, initialEvent, initialDraft, setApplicationTemplate]);
  const clearRecoveredLegacyDraft = () => {
    if (!recoveredLegacyDraft.current) return;
    try { localStorage.removeItem(LEGACY_DRAFT_KEY); recoveredLegacyDraft.current = false; } catch { /* A durable save must still succeed when browser storage is unavailable. */ }
  };
  const hasUnsavedChanges =
    createFormSnapshot(
      formState,
      checkInEvents,
      mentors,
      sponsors,
      questions.applicationTemplate,
      pendingImageFile,
      pendingHeaderFile
    ) !== cleanSnapshot;
  const navigation = useUnsavedChangesGuard(hasUnsavedChanges, bypassUnsavedChangesWarning);

  const handleFieldChange = <K extends keyof EventFormState>(
    field: K,
    value: EventFormState[K]
  ) => {
    resetSuccessMessage();
    questions.setQuestionErrors({});
    setFormState((current) => ({
      ...current,
      [field]: value,
      ...(field === "name" && !current.slug_edited && !initialEvent?.first_published_at && initialEvent?.status !== "active" ? { page_slug: suggestedEventSlug(String(value)) } : {}),
      ...(field === "page_slug" ? { slug_edited: true } : {}),
      ...(field === "status" && value !== "draft" ? { publish_at: "" } : {}),
    }));
  };

  const updateCheckInEvent = (
    index: number,
    field: keyof CheckInSessionDraft,
    value: string
  ) => {
    resetSuccessMessage();
    setCheckInEvents((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addCheckInEvent = () => {
    resetSuccessMessage();
    setCheckInEvents((current) => [
      ...current,
      { ...EMPTY_CHECK_IN_SESSION },
    ]);
  };

  const removeCheckInEvent = (index: number) => {
    resetSuccessMessage();
    setCheckInEvents((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const uploadImage = async (file: File, kind: "icon" | "header" = "icon") => {
    const body = new FormData();
    body.append("file", file);
    body.append("eventName", formState.name || "Untitled event");
    body.append("kind", kind);
    const response = await fetch("/api/upload-event-image", {
      method: "POST",
      body,
    });

    // Not every failure is JSON: the platform rejects oversized bodies before
    // the handler runs, and a non-admin gets an HTML redirect.
    const data = await response
      .json()
      .catch(() => null as { error?: string; url?: string } | null);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          (response.status === 413
            ? EVENT_IMAGE_ERRORS.size
            : "Failed to upload image.")
      );
    }

    if (!data?.url) throw new Error("Failed to upload image.");
    return data.url;
  };

  const draftErrorToastId = useId();
  const retryDraftSave = useRef<(showSuccess: boolean) => void>(() => {});
  useEffect(() => () => toast.dismiss(draftErrorToastId), [draftErrorToastId]);

  const handleSaveDraft = async (showSuccess = true): Promise<boolean> => {
    if (submitLock.current) return false;
    submitLock.current = true;
    toast.dismiss(draftErrorToastId);
    setIsSubmitting(true);
    setError(null);
    const uploads: string[] = [];
    try {
      const saved = { ...formState };
      if (pendingImageFile) { saved.image_url = await uploadImage(pendingImageFile); uploads.push(saved.image_url); }
      if (pendingHeaderFile) { saved.header_image_url = await uploadImage(pendingHeaderFile, "header"); saved.header_colour = ""; uploads.push(saved.header_image_url); }
      const result = await saveAdminEventDraftAction({ id: draftId, eventId: eventId ?? null, revision: draftRevision.current, document: { version: 1, formState: saved, checkInEvents, mentors, sponsors, applicationTemplate: questions.applicationTemplate } });
      draftRevision.current = result.revision;
      clearRecoveredLegacyDraft();
      hasSavedDraft.current = true;
      setFormState(saved);
      setPendingImageFile(null);
      setPendingHeaderFile(null);
      setCleanSnapshot(createFormSnapshot(saved, checkInEvents, mentors, sponsors, questions.applicationTemplate));
      setSuccessMessage("Draft saved");
      if (showSuccess) setShowDraftSaved(true);
      if (!eventId) window.history.replaceState(window.history.state, "", `/admin/events/drafts/${draftId}`);
      return true;
    } catch (error) {
      await Promise.allSettled(uploads.map(url => discardUnusedEventImageAction(url)));
      setError(error instanceof Error ? error.message : "Failed to save draft.");
      toast.error("Couldn’t save your draft", {
        id: draftErrorToastId,
        duration: Infinity,
        description: "Your changes are still here. Check your connection and try again.",
        action: { label: "Try again", onClick: () => retryDraftSave.current(showSuccess) },
      });
      return false;
    } finally { submitLock.current = false; setIsSubmitting(false); }
  };
  // Retry the latest values, including edits made after the failed request.
  useEffect(() => { retryDraftSave.current = showSuccess => { void handleSaveDraft(showSuccess); }; });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current) return;
    setShowConfigurationErrors(true);
    resetSuccessMessage();
    setError(null);
    const hasUnsavedMentors = mentors.some(
      (mentor) => !mentor.id || mentor.isEditing
    );
    const hasUnsavedSponsors = sponsors.some(
      (sponsor) => !sponsor.id || sponsor.isEditing
    );
    if (hasUnsavedMentors || hasUnsavedSponsors) {
      setFormState((current) => ({
        ...current,
        mentors_enabled: current.mentors_enabled || hasUnsavedMentors,
        sponsors_enabled: current.sponsors_enabled || hasUnsavedSponsors,
      }));
      setError(
        "Save or cancel every mentor and sponsor card before saving the event."
      );
      return;
    }
    const validation = validateEventForm(
      formState,
      checkInEvents,
      questions.applicationTemplate,
      mentors,
      sponsors
    );
    questions.setQuestionErrors(validation.questionErrors);
    if (validation.error) {
      setFormState((current) => ({
        ...current,
        mentors_enabled:
          current.mentors_enabled || validation.invalidSections.mentors,
        sponsors_enabled:
          current.sponsors_enabled || validation.invalidSections.sponsors,
        requires_application:
          current.requires_application ||
          validation.invalidSections.applications,
      }));
      setError(validation.error);
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);

    let imageUrl = formState.image_url;
    // Tracked separately so a failure after the upload can take the orphaned
    // object back out instead of leaking one per attempt.
    let uploadedImageUrl: string | null = null;
    let headerUrl = formState.header_image_url;
    let uploadedHeaderUrl: string | null = null;
    try {
      if (pendingImageFile) {
        imageUrl = await uploadImage(pendingImageFile);
        uploadedImageUrl = imageUrl;
      }
      if (pendingHeaderFile) { headerUrl = await uploadImage(pendingHeaderFile, "header"); uploadedHeaderUrl = headerUrl; }
      const payload: EventUpdate = {
        name: formState.name,
        short_description: formState.short_description || null,
        description: formState.description,
        description_rich: formState.description_rich as unknown as Json,
        header_image_url: headerUrl || null,
        header_colour: headerUrl ? null : formState.header_colour || null,
        event_colour: formState.event_colour,
        status: formState.status,
        publish_at: formState.status === "draft"
          ? datetimeLocalToTimestamptz(formState.publish_at)
          : null,
        event_type: formState.event_type,
        mentors_enabled: formState.mentors_enabled,
        sponsors_enabled: formState.sponsors_enabled,
        requires_application: formState.requires_application,
        configured_marketing_mode: formState.marketing_mode,
        configured_marketing_url: formState.marketing_url || null,
        configured_slug_edited: formState.slug_edited,
        configured_slug: formState.slug_edited ? formState.page_slug || null : formState.page_slug || suggestedEventSlug(formState.name),
        is_featured: formState.is_featured,
        ...(formState.pricing_mode === "legacy" ? {} : {
          configured_pricing_mode: formState.pricing_mode,
          configured_price: formState.pricing_mode === "free" ? 0 : Number(formState.pricing_amount),
        }),
        // Effective amounts on existing events are deliberately omitted. New
        // events cannot activate or register until deferred fulfillment lands.
        ...(!eventId ? {
          regular_price: formState.pricing_mode === "legacy" ? Number(formState.regular_price) : formState.pricing_mode === "free" ? 0 : Number(formState.pricing_amount),
          member_price: formState.pricing_mode === "legacy" ? Number(formState.member_price) : 0,
        } : {}),
        max_capacity: Number(formState.max_capacity),
        created_at: formState.created_at || new Date().toISOString(),
        location_building: formState.location_building || undefined,
        location_room: formState.location_room || undefined,
        location_address_url: formState.location_address_url || undefined,
        starts_at: datetimeLocalToTimestamptz(formState.starts_at),
        ends_at: datetimeLocalToTimestamptz(formState.ends_at),
        image_url: imageUrl || null,
        registration_opens_at: datetimeLocalToTimestamptz(
          formState.registration_opens_at
        ),
        registration_closes_at: datetimeLocalToTimestamptz(
          formState.registration_closes_at
        ),
      };
      const checkInSessions = checkInEvents.map((session) => ({
        name: session.name,
        start_time: datetimeLocalToTimestamptz(session.start_time)!,
        end_time: datetimeLocalToTimestamptz(session.end_time)!,
      }));
      const applicationQuestions = questions.applicationTemplate.map(
        (question, sortOrder) => ({
          question: question.question,
          description: question.description || null,
          response_type: question.response,
          is_required: question.is_required,
          sort_order: sortOrder,
          max_char_limit:
            question.response === ResponseType.short_text ||
            question.response === ResponseType.long_text
              ? question.max_char_limit === ""
                ? (eventId ? initialApplicationQuestions[sortOrder]?.max_char_limit ?? null : 5000)
                : question.max_char_limit
              : null,
          response_options:
            question.response === ResponseType.checkbox ||
            question.response === ResponseType.multiple_choice ||
            question.response === ResponseType.dropdown
              ? question.response_options || []
              : null,
          restrict_file_types:
            question.response === ResponseType.file_upload
              ? question.restrict_file_types
              : false,
          allowed_file_types:
            question.response === ResponseType.file_upload &&
            question.restrict_file_types
              ? question.allowed_file_types
              : null,
          max_file_size_bytes:
            question.response === ResponseType.file_upload &&
            question.max_file_size_bytes !== ""
              ? question.max_file_size_bytes
              : null,
        })
      );
      // Preserve legacy/default metadata for untouched questions. Re-encoding
      // a null limit or an irrelevant [] as new defaults must not replace IDs
      // (and cascade responses) during a content or branding update.
      const untouchedQuestions = eventId && JSON.stringify(questions.applicationTemplate) === JSON.stringify(questionsFromRows(initialApplicationQuestions));
      const questionsToSave = untouchedQuestions ? initialApplicationQuestions.map(row => ({
        question: row.question, description: row.description, response_type: row.response_type,
        is_required: row.is_required, sort_order: row.sort_order, max_char_limit: row.max_char_limit,
        response_options: row.response_options, restrict_file_types: row.restrict_file_types,
        allowed_file_types: row.allowed_file_types, max_file_size_bytes: row.max_file_size_bytes,
      })) : applicationQuestions;
      const result = await saveAdminEventAction({
        eventId,
        draftId: hasSavedDraft.current ? draftId : undefined,
        draftRevision: draftRevision.current,
        expectedHeaderImageUrl: persistedHeaderUrl.current,
        expectedImageUrl: persistedImageUrl.current,
        event: payload,
        checkInSessions,
        mentorIds: mentors.map((mentor) => mentor.id!),
        sponsorIds: sponsors.map((sponsor) => sponsor.id!),
        applicationQuestions: questionsToSave,
      });
      hasSavedDraft.current = false;
      clearRecoveredLegacyDraft();
      draftRevision.current = 0;
      setDraftId(crypto.randomUUID());
      const savedFormState = { ...formState, image_url: imageUrl, header_image_url: headerUrl };
      persistedHeaderUrl.current = headerUrl || null;
      setPendingHeaderFile(null);
      persistedImageUrl.current = imageUrl || null;
      setFormState(savedFormState);
      setPendingImageFile(null);
      setCleanSnapshot(
        createFormSnapshot(
          savedFormState,
          checkInEvents,
          mentors,
          sponsors,
          questions.applicationTemplate
        )
      );
      setSuccessMessage(
        eventId ? "Event updated successfully." : "Event created successfully."
      );

      if (onSuccess) {
        bypassUnsavedChangesWarning.current = true;
        onSuccess(result.id);
      } else if (!eventId) {
        bypassUnsavedChangesWarning.current = true;
        router.push("/admin/events");
      } else {
        router.refresh();
      }
    } catch (saveError) {
      // The upload landed but nothing references it, so clean it up. Best
      // effort: the save error is what the admin needs to see.
      if (uploadedHeaderUrl) { await discardUnusedEventImageAction(uploadedHeaderUrl).catch(() => {}); }
      if (uploadedImageUrl) {
        try {
          await discardUnusedEventImageAction(uploadedImageUrl);
        } catch {
          // Leaves an orphaned object; not worth masking the save error.
        }
      }
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save event."
      );
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventId) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAdminEventAction(eventId);
      setShowDeleteModal(false);
      bypassUnsavedChangesWarning.current = true;
      router.push("/admin/events");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete event."
      );
      setIsDeleting(false);
    }
  };

  return {
    formState,
    showConfigurationErrors,
    legacyDraftRecovered,
    hasUnsavedChanges,
    navigation,
    handleSaveDraft,
    showDraftSaved,
    setShowDraftSaved,
    setPendingHeaderFile,
    checkInEvents,
    mentors,
    setMentors,
    sponsors,
    setSponsors,
    isSubmitting,
    loadingEvent: false,
    error,
    setError,
    successMessage,
    showDeleteModal,
    setShowDeleteModal,
    isDeleting,
    setPendingImageFile,
    handleFieldChange,
    updateCheckInEvent,
    addCheckInEvent,
    removeCheckInEvent,
    handleSubmit,
    handleDeleteEvent,
    ...questions,
  };
}
