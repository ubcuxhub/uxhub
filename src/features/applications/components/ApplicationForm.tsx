"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, PencilLine } from "lucide-react";

import { BackPill } from "@/components/shared/BackButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  SectionNavigator,
  type NavigatorSection,
} from "@/components/shared/SectionNavigator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/toast";
import { useUnsavedChangesGuard } from "@/features/admin/hooks/use-unsaved-changes-guard";
import { openSettings } from "@/features/settings/components/SettingsDialog";
import { useCurrentSection } from "@/hooks/use-current-section";
import { createClient } from "@/lib/supabase/client";
import {
  applicationFilePath,
  removeApplicationFiles,
  replaceApplicationFile,
} from "@/lib/supabase-helpers/application-files";
import { cn } from "@/lib/utils";

import {
  deleteApplication,
  saveApplicationDraft,
  startApplicationDraft,
  submitApplication,
} from "../actions";
import type { WriteOutcome } from "../lib/autosave";
import {
  emptyAnswer,
  unansweredRequiredIds,
  validateAnswer,
  type AnswerErrors,
  type AnswerValue,
  type ApplicationAnswers,
  type ApplicationQuestion,
  type ApplicationWindow,
} from "../lib/application-form";
import { useAutosave } from "../hooks/use-autosave";
import { ApplicationAnswersReadOnly } from "./ApplicationAnswersReadOnly";
import { ApplicationSection } from "./ApplicationSection";
import { ApplicationSubmittedDialog } from "./ApplicationSubmittedDialog";
import { AutosaveStatus } from "./AutosaveStatus";
import { QuestionField } from "./fields/QuestionField";
import { questionAnchorId } from "./fields/shared";

export interface ApplicationProfile {
  name: string;
  email: string;
  studentNumber: string;
  year: string;
}

export interface ApplicationFormProps {
  event: { id: string; slug: string; name: string };
  /** `new` until the member first saves. */
  status: "new" | "draft" | "submitted";
  applicationId: string | null;
  window: ApplicationWindow;
  /** Preformatted: "December 13, 2026 at 3:59 PM". */
  opensAt: string | null;
  closesAt: string | null;
  submittedAt: string | null;
  profile: ApplicationProfile;
  questions: ApplicationQuestion[];
  initialAnswers: ApplicationAnswers;
  /** Download links for submitted file answers, keyed by question id. */
  fileLinks?: Record<string, string>;
}

const SECTION = {
  about: "about-you",
  answers: "your-answers",
  review: "review-and-submit",
  settings: "other-settings",
} as const;

/** Scrolls a question into view and focuses its first control. */
function focusQuestion(questionId: string) {
  const target = document.getElementById(questionAnchorId(questionId));
  if (!target) return;
  target.scrollIntoView({ block: "center" });
  target
    .querySelector<HTMLElement>(
      "input:not([type=hidden]):not(:disabled), textarea, button:not(:disabled), [role=radio]"
    )
    ?.focus({ preventScroll: true });
}

const sameAnswer = (a: AnswerValue | undefined, b: AnswerValue | undefined) =>
  JSON.stringify(a ?? "") === JSON.stringify(b ?? "");

/** Typed answers wait for a pause before saving; every other kind saves at once. */
const TYPED = new Set<ApplicationQuestion["response_type"]>(["short_text", "long_text"]);

/**
 * The member's application to one event (Figma A.1 to A.9): About you, the
 * questions, a review that lists what is left, and Delete for a draft.
 * Answers save as they change (`useAutosave`; the first save starts the
 * draft), and file answers when their upload finishes. Submit saves anything
 * waiting, then submits through the RPC. Once submitted, the answers are
 * read-only and the page says it is Pending.
 */
export function ApplicationForm({
  event,
  status,
  applicationId: initialApplicationId,
  window: applicationWindow,
  opensAt,
  closesAt,
  submittedAt,
  profile,
  questions,
  initialAnswers,
  fileLinks,
}: ApplicationFormProps) {
  const router = useRouter();
  const eventHref = `/portal/events/${event.slug}`;
  const [answers, setAnswers] = useState(initialAnswers);
  // What the form holds and what the database holds, for the autosave to
  // compare outside render. A save records only what it sent, so an edit made
  // while it was in flight stays unsaved and is sent next.
  const answersRef = useRef(initialAnswers);
  const savedRef = useRef(initialAnswers);
  const [errors, setErrors] = useState<AnswerErrors>({});
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [submitting, setSubmitting] = useState(false);
  const [submittedNow, setSubmittedNow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({});
  const bypassGuard = useRef(false);

  const readOnly = status === "submitted" || submittedNow;
  const editable = !readOnly && applicationWindow === "open";

  /** Records that `values` are now what the database holds. */
  const markSaved = (values: ApplicationAnswers) => {
    savedRef.current = { ...savedRef.current, ...values };
  };

  /** The typed and chosen answers that differ from the database, or null. */
  const unsavedAnswers = (): ApplicationAnswers | null => {
    const changed: ApplicationAnswers = {};
    for (const question of questions) {
      // A file answer is saved by its upload, never from here.
      if (question.response_type === "file_upload") continue;
      const value = answersRef.current[question.id];
      if (!sameAnswer(value, savedRef.current[question.id])) {
        changed[question.id] = value ?? emptyAnswer(question);
      }
    }
    return Object.keys(changed).length > 0 ? changed : null;
  };

  const writeDraft = async (values: ApplicationAnswers): Promise<WriteOutcome> => {
    const result = await saveApplicationDraft(event.id, values);
    if (result.ok) {
      setApplicationId(result.applicationId);
      markSaved(values);
      return "saved";
    }
    if (result.applicationId) setApplicationId(result.applicationId);
    if (result.reason === "invalid") {
      const fieldErrors = result.fieldErrors;
      if (fieldErrors) setErrors((current) => ({ ...current, ...fieldErrors }));
      return "invalid";
    }
    if (result.reason === "failed" || result.reason === undefined) return "transient";
    // The window closed or the application was submitted elsewhere: the
    // refreshed page shows it read-only.
    toast.error(result.error);
    router.refresh();
    return "refused";
  };

  const [saveState, autosave] = useAutosave({ read: unsavedAnswers, write: writeDraft });
  useUnsavedChangesGuard(
    editable &&
      (saveState.kind === "pending" || saveState.kind === "saving" || saveState.kind === "failed"),
    bypassGuard
  );

  const unanswered = unansweredRequiredIds(questions, answers);
  const errorIds = questions.filter((question) => errors[question.id]).map((q) => q.id);
  const toFix = questions
    .filter((question) => errors[question.id] || unanswered.includes(question.id))
    .map((question) => question.id);
  const answersComplete = toFix.length === 0;
  const hasDraft = applicationId !== null && !readOnly;

  const sectionIds: string[] = readOnly
    ? [SECTION.about, SECTION.answers]
    : [SECTION.about, SECTION.answers, SECTION.review, ...(hasDraft ? [SECTION.settings] : [])];
  const currentId = useCurrentSection(sectionIds);
  const answersState: NavigatorSection["state"] =
    readOnly || answersComplete ? "complete" : errorIds.length > 0 ? "attention" : "not-started";
  const titles: Record<string, string> = {
    [SECTION.about]: "About you",
    [SECTION.answers]: "Your answers",
    [SECTION.review]: "Review and submit",
    [SECTION.settings]: "Other settings",
  };
  const navigatorSections: NavigatorSection[] = sectionIds.map((id) => ({
    id,
    title: titles[id],
    required: id !== SECTION.settings,
    state:
      id === SECTION.about
        ? "complete"
        : id === SECTION.settings
          ? "optional"
          : answersState,
    issues: id === SECTION.answers && errorIds.length > 0 ? errorIds.length : undefined,
  }));

  const setAnswer = (question: ApplicationQuestion, value: AnswerValue) => {
    const next = { ...answersRef.current, [question.id]: value };
    answersRef.current = next;
    setAnswers(next);
    autosave.schedule(TYPED.has(question.response_type) ? undefined : 0);
    if (errors[question.id]) {
      const message = validateAnswer(question, value, "submit");
      setErrors((current) => {
        const next = { ...current };
        if (message) next[question.id] = message;
        else delete next[question.id];
        return next;
      });
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      // Anything waiting saves first, so no autosave runs beside the submit.
      if ((await autosave.flush()).kind === "stopped") return;
      const snapshot = answersRef.current;
      const result = await autosave.exclusive(() => submitApplication(event.id, snapshot));
      if (result.ok) {
        autosave.stop();
        markSaved(snapshot);
        setErrors({});
        setSubmittedNow(true);
        setDialogOpen(true);
        router.refresh();
        return;
      }
      if (result.applicationId) setApplicationId(result.applicationId);
      if (result.saved) {
        markSaved(snapshot);
        autosave.schedule(0);
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors);
        document
          .getElementById(SECTION.review)
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      toast.error(result.error);
    } catch {
      toast.error("Your application couldn't be submitted. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadFile = (question: ApplicationQuestion, file: File) =>
    autosave.exclusive(() => upload(question, file));

  const upload = async (question: ApplicationQuestion, file: File) => {
    const draft = await startApplicationDraft(event.id);
    if (!draft.ok) return draft.error;
    setApplicationId(draft.applicationId);

    const supabase = createClient();
    const saved = savedRef.current[question.id];
    const previous = typeof saved === "string" ? saved : "";
    const path = applicationFilePath({
      userInfoId: draft.userInfoId,
      applicationId: draft.applicationId,
      questionId: question.id,
      fileName: file.name,
    });
    try {
      await replaceApplicationFile(supabase, { path, file, previousPath: previous || null });
    } catch {
      return "The file couldn't be uploaded. Try again.";
    }

    const result = await saveApplicationDraft(event.id, { [question.id]: path });
    if (!result.ok) return result.fieldErrors?.[question.id] ?? result.error;

    setAnswer(question, path);
    markSaved({ [question.id]: path });
    setFileSizes((current) => ({ ...current, [question.id]: file.size }));
    return null;
  };

  const removeFile = (question: ApplicationQuestion) =>
    autosave.exclusive(() => remove(question));

  const remove = async (question: ApplicationQuestion) => {
    const answer = answersRef.current[question.id];
    const path = typeof answer === "string" ? answer : "";
    const result = await saveApplicationDraft(event.id, { [question.id]: "" });
    if (!result.ok) return result.error;
    // The answer no longer names the file, so a failed removal only leaves an
    // orphan, which deleting the draft cleans up.
    if (path) await removeApplicationFiles(createClient(), [path]).catch(() => undefined);
    setAnswer(question, "");
    markSaved({ [question.id]: "" });
    return null;
  };

  const confirmDelete = async () => {
    if (!applicationId) return;
    setDeleting(true);
    setDeleteError(null);
    // No save may land after the delete, where it would start a new draft.
    await autosave.pause();
    try {
      const result = await deleteApplication(applicationId);
      if (!result.ok) {
        setDeleteError(result.error);
        autosave.resume();
        return;
      }
      autosave.stop();
      bypassGuard.current = true;
      toast.success("Application deleted");
      router.push(eventHref);
    } catch {
      setDeleteError("Your application couldn't be deleted. Try again.");
      autosave.resume();
    } finally {
      setDeleting(false);
    }
  };

  const intro = readOnly
    ? `You submitted this application${submittedAt ? ` on ${submittedAt}` : ""}. The UX Hub team reviews every application, and you’ll be notified on the portal and by email once a decision is made.`
    : applicationWindow === "not_open"
      ? `Applications open ${opensAt ?? "soon"}. You can fill this in and submit it then.`
      : applicationWindow === "closed"
        ? `Applications closed${closesAt ? ` ${closesAt}` : ""}. You can still read your draft, but it can no longer be submitted.`
        : `${closesAt ? `Applications close ${closesAt}. ` : ""}The UX Hub team reviews every application, and you’ll be notified on the portal and by email once a decision is made.`;

  return (
    <div
      className="flex flex-col pb-32"
      onBlur={(blur) => {
        // Leaving a text field saves what was typed without waiting.
        if (blur.target instanceof HTMLInputElement || blur.target instanceof HTMLTextAreaElement) {
          autosave.schedule(0);
        }
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 pt-8 sm:px-6 sm:pt-10 lg:px-12">
        <BackPill href={eventHref} label={`Back to ${event.name}`} />
      </div>

      <header className="sticky top-0 z-30 mt-4 border-b border-border-subtle bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-12">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-2.5">
            <h1 className="text-h2">{event.name} application</h1>
            {readOnly ? (
              <StatusBadge status="pending" />
            ) : status === "new" && applicationWindow === "not_open" ? (
              <StatusBadge status="opens" date={opensAt ?? undefined} />
            ) : status === "new" && applicationWindow === "closed" ? (
              <StatusBadge status="registration_closed" label="Applications closed" />
            ) : (
              <StatusBadge label="Draft" tone="neutral" icon={PencilLine} />
            )}
          </div>
          {readOnly ? null : (
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              {editable ? (
                <AutosaveStatus
                  state={saveState}
                  onRetry={autosave.retry}
                  className="flex-1 sm:flex-none"
                />
              ) : null}
              <Button
                type="button"
                className="ml-auto"
                onClick={() => void submit()}
                loading={submitting}
                disabled={!editable || submitting}
              >
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pt-6 sm:px-6 lg:px-12">
        {!readOnly && errorIds.length > 0 ? (
          <Alert variant="destructive" role="alert" icon={<CircleAlert aria-hidden />}>
            <AlertTitle>
              {errorIds.length} {errorIds.length === 1 ? "question" : "questions"} to fix
            </AlertTitle>
            <AlertDescription>
              Finish the questions marked in red, then submit again.
            </AlertDescription>
          </Alert>
        ) : null}

        <p className="text-body text-muted-foreground">{intro}</p>

        <div className="flex flex-col gap-10 sm:gap-14">
          <ApplicationSection id={SECTION.about} number={1} title="About you" complete>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {(
                [
                  ["Name", profile.name],
                  ["Email", profile.email],
                  ["Student number", profile.studentNumber],
                  ["Year level", profile.year],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-body-medium">{label}</dt>
                  <dd className="pt-1 text-body break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-small text-muted-foreground">
              Something wrong?{" "}
              <button
                type="button"
                onClick={() => openSettings("profile")}
                className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:focus-ring"
              >
                Update your profile
              </button>
            </p>
          </ApplicationSection>

          <ApplicationSection
            id={SECTION.answers}
            number={2}
            title="Your answers"
            description={readOnly ? undefined : "All questions are required unless marked optional."}
            complete={answersState === "complete" && questions.length > 0}
            cardClassName={cn(errorIds.length > 0 && !readOnly && "border-destructive")}
          >
            {questions.length === 0 ? (
              <p className="text-body text-muted-foreground">
                This application has no questions.
              </p>
            ) : readOnly ? (
              <ApplicationAnswersReadOnly
                questions={questions}
                answers={answers}
                fileLinks={fileLinks}
              />
            ) : (
              questions.map((question, index) => (
                <Fragment key={question.id}>
                  {index > 0 ? <Separator className="bg-border-subtle" /> : null}
                  <QuestionField
                    question={question}
                    number={index + 1}
                    value={answers[question.id] ?? ""}
                    error={errors[question.id]}
                    disabled={!editable || submitting}
                    onChange={(value) => setAnswer(question, value)}
                    onUpload={(file) => uploadFile(question, file)}
                    onRemove={() => removeFile(question)}
                    fileSize={fileSizes[question.id]}
                  />
                </Fragment>
              ))
            )}
          </ApplicationSection>

          {readOnly ? null : (
            <ApplicationSection
              id={SECTION.review}
              number={3}
              title="Review and submit"
              description="Once you submit, you can’t edit your answers."
              complete={editable && answersComplete}
            >
              <ReviewSummary
                window={applicationWindow}
                opensAt={opensAt}
                closesAt={closesAt}
                toFix={toFix}
                hasErrors={errorIds.length > 0}
                questions={questions}
              />
            </ApplicationSection>
          )}

          {hasDraft ? (
            <ApplicationSection
              id={SECTION.settings}
              number={4}
              title="Other settings"
              description="Actions that affect your whole application."
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="min-w-0 flex-1">
                  <p className="text-small font-semibold">Delete application</p>
                  <p className="pt-0.5 text-small text-muted-foreground">
                    Deletes your draft and all your answers. Once you submit, your
                    application can’t be deleted.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="self-start sm:self-auto"
                  disabled={submitting || deleting}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteOpen(true);
                  }}
                >
                  Delete application
                </Button>
              </div>
            </ApplicationSection>
          ) : null}
        </div>
      </div>

      <SectionNavigator
        title={`${event.name} application`}
        sections={navigatorSections}
        currentId={currentId}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete application?"
        description="This deletes your draft, your answers and any files you uploaded. You can’t undo this."
        confirmLabel="Delete application"
        pendingLabel="Deleting…"
        cancelLabel="Keep draft"
        pending={deleting}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />

      <ApplicationSubmittedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventName={event.name}
        eventHref={eventHref}
      />
    </div>
  );
}

function ReviewSummary({
  window: applicationWindow,
  opensAt,
  closesAt,
  toFix,
  hasErrors,
  questions,
}: {
  window: ApplicationWindow;
  opensAt: string | null;
  closesAt: string | null;
  toFix: string[];
  hasErrors: boolean;
  questions: readonly ApplicationQuestion[];
}) {
  if (applicationWindow !== "open") {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-subheading">
          {applicationWindow === "not_open" ? "Applications aren’t open yet" : "Applications closed"}
        </h3>
        <p className="text-body text-muted-foreground">
          {applicationWindow === "not_open"
            ? `You can submit once applications open${opensAt ? ` ${opensAt}` : ""}.`
            : `Applications closed${closesAt ? ` ${closesAt}` : ""}, so this draft can’t be submitted.`}
        </p>
      </div>
    );
  }

  if (toFix.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-subheading">Ready to submit</h3>
        <p className="text-body text-muted-foreground">
          Everything required is answered. Press Submit at the top when you’re ready.
        </p>
      </div>
    );
  }

  const numberOf = new Map(questions.map((question, index) => [question.id, index + 1]));
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-subheading">{hasErrors ? "A few things to fix" : "Almost ready"}</h3>
      <p className="text-body text-muted-foreground">Answer these, then press Submit at the top.</p>
      <ul className="flex flex-wrap gap-2 pt-1">
        {toFix.map((id) => (
          <li key={id}>
            <Button type="button" variant="secondary" onClick={() => focusQuestion(id)}>
              Question {numberOf.get(id)}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
