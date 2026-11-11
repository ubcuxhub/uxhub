"use client";

import { emptyContent, eventContentProblem, legacyEventContent, type EventContent } from "../lib/event-content";

import type { EventApplicationSettingsRow } from "@/lib/supabase/models";

import { dateSessions, emptyEventDate, emptyLocation, type EventDateLocationDraft } from "../lib/event-date-location";

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
import { EVENT_IMAGE_ERRORS } from "@/lib/event-image";
import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
  EventUpdate,
  MentorRow,
  SponsorRow,
} from "@/lib/supabase/models";
import type {
  CheckInSessionDraft,
} from "@/features/admin/types";
import {
  defaultFormState,
  checkInDraftsFromRows,
  createFormSnapshot,
  EMPTY_CHECK_IN_SESSION,
  formStateFromEvent,
  getInitialFormState,
  toApplicationQuestionInputs,
  toCheckInSessionInputs,
  questionsFromRows,
  validateEventForm,
  withSavedCheckInSessionIds,
  withSavedQuestionIds,
  type EventFormState,
  type MentorDraft,
  type SponsorDraft,
} from "../components/event-form/event-form-schema";
import { datetimeLocalToTimestamptz, timestamptzToDatetimeLocal } from "@/lib/date";
import { useApplicationQuestions } from "./use-application-questions";
import { parseWorkingDocument, type EventWorkingDocument } from "../lib/event-working-document";
import type { Json } from "@/lib/supabase/database.types";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

interface UseEventFormOptions {
  /** Validate uncommitted control text before using the model’s last value. */
  validateControls?: (draft: boolean) => boolean;
  initialContent?: EventContent;
  initialApplicationSettings?: EventApplicationSettingsRow | null;
  initialDateLocation?: { document: EventDateLocationDraft; revision: number } | null;
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

export function useEventForm({
  initialContent,
  eventId: initialEventId,
  initialDateLocation,
  initialDraft,
  initialEvent = null,
  initialCheckInSessions = [],
  initialApplicationQuestions = [],
  initialApplicationSettings,
  initialMentors = [],
  initialSponsors = [],
  onSuccess,
  validateControls,
}: UseEventFormOptions) {
  const router = useRouter();
  const [eventId, setEventId] = useState(initialEventId);
  const [publication, setPublication] = useState({ status: initialEvent?.status ?? "draft", publish_at: initialEvent?.publish_at ?? null });
  const expectedPublication = useRef(initialEvent ? { status: initialEvent.status, publish_at: initialEvent.publish_at } : null);
  const [publicationSuccess, setPublicationSuccess] = useState<null | { id: string; name: string; status: string; publish_at: string | null; registration_opens_at: string | null; registration_closes_at: string | null; completed_at: number }>(null);
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const startingFormState = useMemo(
    () => {
      const state = initialDraft?.document.formState;
      const recoverDateLocation = (source: EventFormState): EventDateLocationDraft => {
        if (initialDateLocation) return initialDateLocation.document;
        const sessions = initialDraft?.document.checkInEvents.length
          ? initialDraft.document.checkInEvents
          : checkInDraftsFromRows(initialCheckInSessions);
        return {
          automatic: true,
          audience: "everyone",
          location: { ...emptyLocation(), type: initialEvent?.location_type ?? "in_person", building: source.location_building, room: source.location_room, address: initialEvent?.location_address ?? "", map_url: source.location_address_url },
          dates: sessions.length ? sessions.map(row => ({ ...emptyEventDate(), session_id: row.id ?? null, date: row.start_time.split("T")[0], start: row.start_time.split("T")[1] ?? "", end: row.end_time.split("T")[1] ?? "", label: row.name })) : [{ ...emptyEventDate(), date: source.starts_at.split("T")[0], start: source.starts_at.split("T")[1] ?? "", end: source.ends_at.split("T")[1] ?? "" }],
        };
      };
      if (!state) {
        if (!initialEvent) return { ...getInitialFormState(), content: initialContent ?? emptyContent() };
        const source = { ...formStateFromEvent(initialEvent), decisions_release_at: timestamptzToDatetimeLocal(initialApplicationSettings?.decisions_release_at), confirmation_deadline: timestamptzToDatetimeLocal(initialApplicationSettings?.confirmation_deadline) };
        return { ...source, content: initialContent ?? emptyContent(), date_location_revision: initialDateLocation?.revision ?? 0, date_location: recoverDateLocation(source) };
      }
      const teamSource = state.teams_configuration_initialized === false && initialEvent ? formStateFromEvent(initialEvent) : { ...defaultFormState, ...state };
      const restored = { ...defaultFormState, ...state, content: state.content ?? legacyEventContent(initialDraft?.document.mentors ?? [], initialDraft?.document.sponsors ?? [], initialContent), schedule_configuration_initialized: true, agenda_enabled: state.schedule_configuration_initialized === false && initialEvent ? initialEvent.agenda_enabled ?? true : state.agenda_enabled ?? defaultFormState.agenda_enabled, teams_configuration_initialized: true, teams_enabled: teamSource.teams_enabled, min_team_size: teamSource.min_team_size, max_team_size: teamSource.max_team_size, team_deadline: teamSource.team_deadline, date_location: state.date_location ?? recoverDateLocation(state), date_location_revision: state.date_location ? state.date_location_revision : initialDateLocation?.revision ?? state.date_location_revision };
      // Old working documents never captured these settings. Recover them
      // from the source event instead of resetting a saved featured choice,
      // external destination or URL during an unrelated edit.
      if (state.configuration_initialized === false && initialEvent) {
        const source = formStateFromEvent(initialEvent);
        return { ...restored, configuration_initialized: true,
          marketing_mode: source.marketing_mode, marketing_url: source.marketing_url,
          page_slug: source.page_slug, slug_edited: source.slug_edited,
          is_featured: source.is_featured, pricing_mode: source.pricing_mode,
          pricing_amount: source.pricing_amount };
      }
      return restored;
    },
    [initialEvent, initialDraft, initialDateLocation, initialCheckInSessions, initialApplicationSettings, initialContent]
  );
  const startingCheckIns = useMemo(
    () =>
      initialDraft?.document.checkInEvents ?? (initialCheckInSessions.length
        ? checkInDraftsFromRows(initialCheckInSessions)
        : [{ ...EMPTY_CHECK_IN_SESSION }]),
    [initialCheckInSessions, initialDraft]
  );
  const startingQuestions = useMemo(
    () => initialApplicationSettings?.questions_locked_at ? questionsFromRows(initialApplicationQuestions) : initialDraft?.document.applicationTemplate ?? questionsFromRows(initialApplicationQuestions),
    [initialApplicationQuestions, initialDraft, initialApplicationSettings]
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
  const lastSavedDraftState = useRef<EventFormState | null>(null);
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
        setFormState({ ...document.formState, content: document.formState.content ?? legacyEventContent(document.mentors, document.sponsors), date_location: document.formState.date_location ?? getInitialFormState().date_location });
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
      ...(field === "date_location" && value && typeof value === "object" && "dates" in value ? {
        starts_at: value.dates.map(row => `${row.date}T${row.start}`).sort()[0] ?? "",
        ends_at: value.dates.map(row => `${row.date}T${row.end}`).sort().at(-1) ?? "",
      } : {}),
      ...(field === "name" && !current.slug_edited && !initialEvent?.first_published_at && initialEvent?.status !== "active" ? { page_slug: suggestedEventSlug(String(value)) } : {}),
      ...(field === "page_slug" ? { slug_edited: true } : {}),
      ...(field === "status" && value !== "draft" ? { publish_at: "" } : {}),
    }));
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
    if (validateControls && !validateControls(true)) {
      setError("Finish or clear invalid field text before saving a draft.");
      setValidationAttempt(value => value + 1);
      return false;
    }
    submitLock.current = true;
    toast.dismiss(draftErrorToastId);
    setIsSubmitting(true);
    setError(null);
    const uploads: string[] = [];
    try {
      if (formState.content) { const problem = eventContentProblem(formState.content, true); if (problem) { setShowConfigurationErrors(true); window.dispatchEvent(new Event("event-content-invalid")); throw new Error(problem); } }
      const saved = { ...formState };
      if (pendingImageFile) { saved.image_url = await uploadImage(pendingImageFile); uploads.push(saved.image_url); }
      if (pendingHeaderFile) { saved.header_image_url = await uploadImage(pendingHeaderFile, "header"); saved.header_colour = ""; uploads.push(saved.header_image_url); }
      const result = await saveAdminEventDraftAction({ id: draftId, eventId: eventId ?? null, revision: draftRevision.current, document: { version: 1, formState: saved, checkInEvents, mentors, sponsors, applicationTemplate: questions.applicationTemplate } });
      lastSavedDraftState.current = saved;
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

  const publicationToastId = useId();
  useEffect(() => () => toast.dismiss(publicationToastId), [publicationToastId]);
  const retryPublication = useRef<(intent: "publish" | "schedule" | "cancel" | "save") => void>(() => {});
  const saveEvent = async (state: EventFormState, intent: "publish" | "schedule" | "cancel" | "save", uploadedWithDraft = false): Promise<boolean> => {
    if (submitLock.current) return false;
    toast.dismiss(publicationToastId);
    setShowConfigurationErrors(true);
    resetSuccessMessage();
    setError(null);
    const validation = validateEventForm(
      state,
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
      setValidationAttempt(value => value + 1);
      return false;
    }
    submitLock.current = true;
    setIsSubmitting(true);

    let imageUrl = state.image_url;
    // Tracked separately so a failure after the upload can take the orphaned
    // object back out instead of leaking one per attempt.
    let uploadedImageUrl: string | null = null;
    let headerUrl = state.header_image_url;
    let uploadedHeaderUrl: string | null = null;
    try {
      if (pendingImageFile && !uploadedWithDraft) {
        imageUrl = await uploadImage(pendingImageFile);
        uploadedImageUrl = imageUrl;
      }
      if (pendingHeaderFile && !uploadedWithDraft) { headerUrl = await uploadImage(pendingHeaderFile, "header"); uploadedHeaderUrl = headerUrl; }
      const payload: EventUpdate = {
        name: state.name,
        short_description: state.short_description || null,
        description: state.description,
        description_rich: state.description_rich as unknown as Json,
        header_image_url: headerUrl || null,
        header_colour: headerUrl ? null : state.header_colour || null,
        event_colour: state.event_colour,
        status: state.status,
        publish_at: state.status === "draft"
          ? datetimeLocalToTimestamptz(state.publish_at)
          : null,
        event_type: state.event_type,
        mentors_enabled: state.mentors_enabled,
        sponsors_enabled: state.sponsors_enabled,
        agenda_enabled: state.agenda_enabled,
        teams_enabled: state.teams_enabled,
        min_team_size: state.min_team_size === "" ? null : Number(state.min_team_size),
        max_team_size: state.max_team_size === "" ? null : Number(state.max_team_size),
        team_deadline: datetimeLocalToTimestamptz(state.team_deadline),
        requires_application: state.requires_application,
        configured_marketing_mode: state.marketing_mode,
        configured_marketing_url: state.marketing_url || null,
        configured_slug_edited: state.slug_edited,
        configured_slug: state.slug_edited ? state.page_slug || null : state.page_slug || suggestedEventSlug(state.name),
        is_featured: state.is_featured,
        ...(state.pricing_mode === "legacy" ? {} : {
          configured_pricing_mode: state.pricing_mode,
          configured_price: state.pricing_mode === "free" ? 0 : Number(state.pricing_amount),
        }),
        // Effective amounts on existing events are deliberately omitted. New
        // events cannot activate or register until deferred fulfillment lands.
        ...(!eventId ? {
          regular_price: state.pricing_mode === "legacy" ? Number(state.regular_price) : state.pricing_mode === "free" ? 0 : Number(state.pricing_amount),
          member_price: state.pricing_mode === "legacy" ? Number(state.member_price) : 0,
        } : {}),
        max_capacity: Number(state.max_capacity),
        created_at: state.created_at || new Date().toISOString(),
        location_building: state.location_building || undefined,
        location_room: state.location_room || undefined,
        location_address_url: state.location_address_url || undefined,
        starts_at: datetimeLocalToTimestamptz(state.starts_at),
        ends_at: datetimeLocalToTimestamptz(state.ends_at),
        image_url: imageUrl || null,
        registration_opens_at: datetimeLocalToTimestamptz(
          state.registration_opens_at
        ),
        registration_closes_at: datetimeLocalToTimestamptz(
          state.registration_closes_at
        ),
      };
      const checkInSessions = state.date_location ? dateSessions(state.date_location) : toCheckInSessionInputs(checkInEvents);
      const applicationQuestions = initialApplicationSettings?.questions_locked_at ? initialApplicationQuestions : toApplicationQuestionInputs(questions.applicationTemplate);
      const result = await saveAdminEventAction({
        eventId,
        expectedPublication: expectedPublication.current,
        content: state.content ?? undefined,
        draftId: hasSavedDraft.current ? draftId : undefined,
        draftRevision: draftRevision.current,
        expectedHeaderImageUrl: persistedHeaderUrl.current,
        expectedImageUrl: persistedImageUrl.current,
        event: payload,
        dateLocation: state.date_location,
        dateLocationRevision: state.date_location_revision,
        checkInSessions,
        mentorIds: mentors.map((mentor) => mentor.id!),
        sponsorIds: sponsors.map((sponsor) => sponsor.id!),
        applicationTiming: { decisions_release_at: datetimeLocalToTimestamptz(state.decisions_release_at), confirmation_deadline: datetimeLocalToTimestamptz(state.confirmation_deadline) },
        applicationQuestions,
      });
      // A refusal the admin can act on, such as removing a question people
      // have applied with or a session people have checked in to. Nothing was
      // saved, so the image cleanup below runs.
      if ("error" in result) throw new Error(result.error);
      const savedCheckIns = withSavedCheckInSessionIds(
        checkInEvents,
        result.checkInSessionIds
      );
      setCheckInEvents(savedCheckIns);
      const savedTemplate = withSavedQuestionIds(
        questions.applicationTemplate,
        result.questionIds
      );
      questions.setApplicationTemplate(savedTemplate);
      hasSavedDraft.current = false;
      clearRecoveredLegacyDraft();
      draftRevision.current = 0;
      setDraftId(crypto.randomUUID());
      const savedFormState = { ...state, content: result.content ?? state.content, image_url: imageUrl, header_image_url: headerUrl,
        date_location_revision: result.dateLocationRevision ?? state.date_location_revision,
        date_location: state.date_location ? { ...state.date_location, dates: state.date_location.dates.map((row, index) => ({ ...row, session_id: result.checkInSessionIds[index] ?? row.session_id })) } : null };
      persistedHeaderUrl.current = headerUrl || null;
      setPendingHeaderFile(null);
      persistedImageUrl.current = imageUrl || null;
      setPendingImageFile(null);
      const savedPublication = result.publication ?? { id: result.id, name: savedFormState.name, status: savedFormState.status, publish_at: datetimeLocalToTimestamptz(savedFormState.publish_at), registration_opens_at: datetimeLocalToTimestamptz(savedFormState.registration_opens_at), registration_closes_at: datetimeLocalToTimestamptz(savedFormState.registration_closes_at) };
      expectedPublication.current = { status: savedPublication.status as EventFormState["status"], publish_at: savedPublication.publish_at };
      setPublication(expectedPublication.current);
      setEventId(result.id);
      const actualState = { ...savedFormState, status: savedPublication.status as EventFormState["status"], publish_at: timestamptzToDatetimeLocal(savedPublication.publish_at) };
      setFormState(actualState);
      setCleanSnapshot(createFormSnapshot(actualState, savedCheckIns, mentors, sponsors, savedTemplate));
      setSuccessMessage(intent === "cancel" ? "Schedule cancelled. Draft saved." : "Changes saved");
      if (!eventId) window.history.replaceState(window.history.state, "", `/admin/events/${result.id}/edit`);
      if (intent === "publish" || intent === "schedule") setPublicationSuccess({ ...savedPublication, completed_at: Date.now() });
      if (onSuccess) onSuccess(result.id);
      return true;
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
      const message = saveError instanceof Error ? saveError.message : "Failed to save event.";
      setError(message);
      if (intent) toast.error("Couldn’t save publication changes", { id: publicationToastId, duration: Infinity, description: `${message} Your edits are still here. If the response was lost, reload to check the saved state or retry.`, action: { label: "Try again", onClick: () => retryPublication.current(intent) } });
      return false;
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const validation = validateEventForm(formState, checkInEvents, questions.applicationTemplate, mentors, sponsors);
  const handlePublication = async (intent: "publish" | "schedule" | "cancel" | "save", publishAt = formState.publish_at) => {
    setPublishAttempted(true);
    const state = { ...formState, status: intent === "publish" ? "active" as const : publication.status, publish_at: intent === "publish" || intent === "cancel" ? "" : intent === "schedule" ? publishAt : formState.publish_at };
    const controlsValid = validateControls?.(false) ?? true;
    const nextValidation = validateEventForm(state, checkInEvents, questions.applicationTemplate, mentors, sponsors);
    if (nextValidation.error || !controlsValid) {
      setShowConfigurationErrors(true);
      setValidationAttempt(value => value + 1);
      setError(nextValidation.error ?? "Fix the invalid fields before publishing.");
      return false;
    }
    setFormState(state);
    // A durable working-document identity makes a new event's publication
    // retry reuse the same materialization after response loss.
    let uploadedWithDraft = false;
    if (!eventId && !hasSavedDraft.current) {
      if (!await handleSaveDraft(false)) return false;
      uploadedWithDraft = true;
      if (lastSavedDraftState.current) {
        state.image_url = lastSavedDraftState.current.image_url;
        state.header_image_url = lastSavedDraftState.current.header_image_url;
      }
      setFormState(state);
    }
    return saveEvent(state, intent, uploadedWithDraft);
  };
  useEffect(() => { retryPublication.current = intent => { void handlePublication(intent); }; });
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handlePublication(publication.status === "active" || publication.publish_at ? "save" : "publish");
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
    eventId,
    publication,
    publicationSuccess,
    setPublicationSuccess,
    publishAttempted,
    validationAttempt,
    validation,
    handlePublication,
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
    sponsors,
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
    handleSubmit,
    handleDeleteEvent,
    ...questions,
  };
}
