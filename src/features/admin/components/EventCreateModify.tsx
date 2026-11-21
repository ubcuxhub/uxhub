"use client";

import Link from "next/link";
import { ArrowLeft, Ellipsis, Info, Lock, Trash2, Undo2 } from "lucide-react";
import { Hubbo } from "@/components/shared/Hubbo";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { EventHistoryInfo } from "@/lib/supabase-helpers/event-mutations";
import type { EventApplicationSettingsRow } from "@/lib/supabase/models";
import { EventTeams } from "./event-form/EventTeams";
import { EventAgenda } from "./event-form/EventAgenda";
import type { EventFormIssue } from "./event-form/event-form-schema";
import { EventPublishMenu, EventPublicationSuccess, publicationTimeLabel } from "./event-form/EventPublicationControls";
import type { EventTeamSettingsInfo } from "@/lib/supabase-helpers/teams";
import { ApplicationTiming } from "./event-form/ApplicationTiming";

import { EventPricing } from "./event-form/EventPricing";
import { EventFeatured } from "./event-form/EventMarketing";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BackButton } from "@/components/shared/BackButton";
import { SectionNavigator, type NavigatorSection } from "@/components/shared/SectionNavigator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EventBranding } from "./event-form/EventBranding";
import { EventDescriptionEditor } from "./event-form/EventDescriptionEditor";
import { EventLeaveDialog } from "./EventLeaveDialog";
import { EventUnpublishDialog } from "./EventUnpublishDialog";
import type { EventWorkingDocument } from "../lib/event-working-document";
import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
  MentorRow,
  SponsorRow,
} from "@/lib/supabase/models";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  FieldValidation,
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { useEventForm } from "@/features/admin/hooks/use-event-form";
import { PrimaryDetailsSection } from "./event-form/PrimaryDetailsSection";
import { EventRegistration } from "./event-form/EventRegistration";
import { type EventDateLocationDraft } from "../lib/event-date-location";
import { EventPeopleEditor, EventResourcesEditor } from "./event-form/EventPeopleResources";
import { emptyContent, type EventContent } from "../lib/event-content";
import { ApplicationQuestionsSection } from "./event-form/ApplicationQuestionsSection";
import { DeleteEventModal } from "./DeleteEventModal";

interface EventCreateModifyProps {
  historyInfo?: EventHistoryInfo;
  initialContent?: EventContent;
  initialApplicationSettings?: EventApplicationSettingsRow | null;
  initialDateLocation?: { document: EventDateLocationDraft; revision: number } | null;
  registrationInfo?: { locked: boolean; seats: number };
  pricingLocked?: boolean;
  teamInfo?: EventTeamSettingsInfo;
  eventId?: string;
  /** Hide when the surrounding record page supplies navigation. */
  showBackButton?: boolean;
  initialDraft?: { id: string; revision: number; document: EventWorkingDocument } | null;
  initialEvent?: EventRow | null;
  initialCheckInSessions?: CheckInSessionRow[];
  initialApplicationQuestions?: EventApplicationQuestionRow[];
  initialMentors?: MentorRow[];
  initialSponsors?: SponsorRow[];
  mentorOptions?: MentorRow[];
  sponsorOptions?: SponsorRow[];
  onSuccess?: (id: string) => void;
}

export const EventCreateModify = ({
  eventId,
  historyInfo,
  initialContent,
  showBackButton = true,
  pricingLocked = false,
  teamInfo = { teamCount: 0, largestTeam: 0 },
  initialDateLocation,
  initialApplicationSettings,
  registrationInfo = { locked: false, seats: 0 },
  initialDraft,
  initialEvent = null,
  initialCheckInSessions = [],
  initialApplicationQuestions = [],
  initialMentors = [],
  initialSponsors = [],
  mentorOptions = [],
  sponsorOptions = [],
  onSuccess,
}: EventCreateModifyProps) => {
  const formElement = useRef<HTMLFormElement>(null);
  const nativeFrame = useRef<number | null>(null);
  const [inputIssues, setInputIssues] = useState<EventFormIssue[]>([]);
  const collectInputIssues = (draft = false): EventFormIssue[] => Array.from(formElement.current?.querySelectorAll<HTMLInputElement>("input:invalid, textarea:invalid, select:invalid") ?? []).filter(control => !draft || !control.validity.valueMissing).map(control => ({
    section: (control.closest("[data-builder-section]")?.id.replace("builder-", "") ?? "publish") as EventFormIssue["section"],
    target: control.id || control.closest("[data-builder-section]")?.id || "builder-publish",
    message: control.validationMessage,
    required: control.validity.valueMissing,
  }));
  const captureInputIssues = () => {
    if (nativeFrame.current !== null) cancelAnimationFrame(nativeFrame.current);
    nativeFrame.current = requestAnimationFrame(() => setInputIssues(collectInputIssues()));
  };
  useEffect(() => () => { if (nativeFrame.current !== null) cancelAnimationFrame(nativeFrame.current); }, []);
  const form = useEventForm({
    validateControls: draft => { const found = collectInputIssues(draft); setInputIssues(found); return found.length === 0; },
    eventId,
    initialContent,
    initialDateLocation,
    initialApplicationSettings,
    initialDraft,
    initialEvent,
    initialCheckInSessions,
    initialApplicationQuestions,
    initialMentors,
    initialSponsors,
    onSuccess,
  });

  const header = useRef<HTMLDivElement>(null);
  // Revert asks first: members lose access, and the database refuses while
  // any are registered (docs/event-states.md, "Unpublishing").
  const [revertOpen, setRevertOpen] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  // The "More actions" menu hands focus to a dialog, so it skips its own focus
  // return and the dialog gives focus back to the trigger once it closes.
  const moreActions = useRef<HTMLButtonElement>(null);
  const menuOpensDialog = useRef(false);
  const returnFocusToMoreActions = () => setTimeout(() => moreActions.current?.focus(), 0);
  const [offset, setOffset] = useState(86);
  const [currentId, setCurrentId] = useState("builder-basics");
  const published = form.publication.status === "active";
  const scheduled = !!form.publication.publish_at;
  const draft = !published && !scheduled;
  // Revert hides a live event again; an ended or canceled one stays as it was.
  const canRevert = published && !form.past;
  const issueSections: EventFormIssue["section"][] = ["basics", "description", "agenda", "registration", "teams", "people", "resources", "publish"];
  const issues = [...new Map([...form.validation.issues, ...form.serverIssues, ...inputIssues].map(issue => [`${issue.section}:${issue.target}`, issue])).values()].filter(issue => !form.past || issue.section === "resources").sort((a, b) => issueSections.indexOf(a.section) - issueSections.indexOf(b.section));
  const publicationReady = issues.length === 0;
  const visibleIssues = issues.filter(issue => form.publishAttempted || !issue.required);
  const publishIssues = issues.filter(issue => issue.section === "publish");
  const focusIssue = (issue: EventFormIssue) => {
    if (issue.section === "people") window.dispatchEvent(new Event("event-content-invalid"));
    const target = document.getElementById(issue.target);
    const section = document.getElementById(`builder-${issue.section}`);
    section?.scrollIntoView({ block: "start", behavior: "instant" });
    const control = target?.matches("input,textarea,button,[contenteditable=true]") ? target : target?.querySelector<HTMLElement>("input,textarea,button,[contenteditable=true]");
    (control ?? section?.querySelector<HTMLElement>("h2"))?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!form.validationAttempt) return;
    const issue = form.publishAttempted ? issues[0] : visibleIssues[0];
    if (!issue) return;
    const frame = requestAnimationFrame(() => focusIssue(issue));
    return () => cancelAnimationFrame(frame);
    // Only a failed action should move focus; typing must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.validationAttempt]);
  const saveStatus = form.hasUnsavedChanges ? "Unsaved changes" : form.successMessage || (initialDraft || initialEvent ? "Saved" : "Not saved yet");
  const sectionDetails: Record<string, { number: number; description?: string }> = {
    "builder-basics": { number: 1, description: "What the event is called, where its page lives, how it looks and what it costs." },
    "builder-description": { number: 2, description: "How the event is described across the portal and the club website." },
    "builder-agenda": { number: 3, description: "Every day, location and timed item, including optional check-in." },
    "builder-registration": { number: 4, description: "How members sign up, how many can and how they check in." },
    "builder-teams": { number: 5, description: "Team events show a Your Team card with an invite link on the event page." },
    "builder-people": { number: 6 },
    "builder-resources": { number: 7, description: "Community links, files and the event recap for this event." },
  };
  const sections: NavigatorSection[] = [
    { id: "builder-basics", number: 1, title: "Basics", state: "complete", required: true },
    { id: "builder-description", number: 2, title: "Description", state: "complete", required: true },
    { id: "builder-agenda", number: 3, title: "Agenda", state: "complete", required: true },
    { id: "builder-registration", number: 4, title: "Registration", state: "complete", required: true },
    { id: "builder-teams", number: 5, title: "Teams", state: form.formState.teams_enabled ? "complete" : "optional", required: false },
    { id: "builder-people", number: 6, title: "People and sponsors", state: form.formState.content?.sections.length ? "complete" : "optional", required: false },
    { id: "builder-resources", number: 7, title: "Links and resources", state: form.formState.content?.links.length ? "complete" : "optional", required: false },
  ].map((section): NavigatorSection => {
    const key = section.id.replace("builder-", "");
    const all = issues.filter(issue => issue.section === key);
    const visible = visibleIssues.filter(issue => issue.section === key);
    return { ...section, state: visible.length ? "attention" : all.length ? "not-started" : section.state as NavigatorSection["state"], issues: visible.length || undefined };
  });
  const sectionsWithIssues = sections.filter(item => issues.some(issue => `builder-${issue.section}` === item.id));
  useEffect(() => {
    if (!header.current) return;
    const observer = new ResizeObserver(entries => setOffset(Math.max(0, entries[0].contentRect.height - 40) + 24));
    observer.observe(header.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setCurrentId(visible[0].target.id);
    }, { rootMargin: `-${offset}px 0px -55% 0px` });
    document.querySelectorAll("[data-builder-section]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [offset]);
  const section = (id: string, title: string, children: ReactNode) => {
    const status = sections.find(section => section.id === id)!;
    return (
    <section id={id} data-builder-section style={{ scrollMarginTop: offset + (typeof window !== "undefined" && window.innerWidth < 640 ? 56 : 0) }} className="space-y-4 border-t border-border pt-14 first:border-0 first:pt-0">
      <div className="flex items-start justify-between gap-3 pb-2"><div>
        <p className="text-badge text-muted-foreground">Section {sectionDetails[id].number}</p>
        <h2 tabIndex={-1} className="pt-1 text-h3 outline-none focus-visible:focus-ring">{title}</h2>
        {sectionDetails[id].description && <p className="pt-0.5 text-muted-foreground">{sectionDetails[id].description}</p>}
      </div>{status.issues ? <StatusBadge label={`${status.issues} to fix`} tone="error" /> : status.state === "complete" ? <StatusBadge label="Complete" tone="success" /> : !status.required ? <StatusBadge label="Optional" tone="neutral" /> : null}</div>
      {form.past && id !== "builder-resources" ? <fieldset disabled onDragStartCapture={event => event.preventDefault()} className="min-w-0 space-y-4"><legend className="mb-3 flex items-center gap-2 text-small text-muted-foreground"><Lock aria-hidden className="size-4" />Locked</legend>{children}</fieldset> : children}
    </section>
    );
  };

  return (
    <FieldValidation errors={visibleIssues}><div className="event-builder flex w-full min-w-0 flex-col gap-6 pb-50">
      <div id="event-builder-header" ref={header} className="sticky top-4 z-20 -mx-5 space-y-2 border-b border-border-subtle bg-background px-5 pb-3.5 sm:-top-10 sm:-mx-6 sm:px-6 min-[821px]:-mx-12 min-[821px]:px-12">
        {showBackButton && <BackButton link="/admin/events" label="Back to Manage Events" className="h-8 w-fit px-4 text-small" />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1 className="break-words text-h2">{form.formState.name || "Untitled event"}</h1>
            {form.canceled ? <StatusBadge status="canceled" /> : <StatusBadge label={form.past ? "Past" : scheduled ? "Scheduled" : published ? "Published" : "Draft"} tone={form.past ? "neutral" : scheduled ? "info" : published ? "success" : "neutral"} />}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className="text-small text-muted-foreground">{saveStatus}{form.canceled ? " · Canceled" : form.past ? ` · Ended ${publicationTimeLabel(form.savedEnd!)}` : scheduled ? ` · Goes live ${publicationTimeLabel(form.publication.publish_at!)}` : published ? " · Published" : ""}</span>
            {draft && <Button type="button" size="sm" variant="outline" disabled={!form.hasUnsavedChanges || form.isDeleting} loading={form.isSubmitting} onClick={() => void form.handleSaveDraft()}>Save</Button>}
            {(scheduled || published) && form.hasUnsavedChanges && <Button type="button" size="sm" variant="outline" disabled={form.isSubmitting || form.unresolvedSave} onClick={() => { form.handleDiscardChanges(); setInputIssues([]); }}>Discard changes</Button>}
            {(scheduled || published) && <Button disabled={!form.hasUnsavedChanges || form.isDeleting} type="button" size="sm" loading={form.isSubmitting} onClick={() => void form.handlePublication("save")}>{scheduled ? "Save changes" : "Update"}</Button>}
            {!published && <EventPublishMenu form={form} size="sm" disabled={!publicationReady} />}
            {(canRevert || form.eventId) && <DropdownMenu>
              <DropdownMenuTrigger asChild><IconButton ref={moreActions} label="More actions" className="shrink-0"><Ellipsis aria-hidden /></IconButton></DropdownMenuTrigger>
              <DropdownMenuContent align="end" collisionPadding={20} className="z-40 min-w-48" onCloseAutoFocus={event => { if (menuOpensDialog.current) event.preventDefault(); menuOpensDialog.current = false; }}>
                {canRevert && <DropdownMenuItem disabled={form.isSubmitting || form.isDeleting} onSelect={() => { menuOpensDialog.current = true; setRevertError(null); setRevertOpen(true); }}><Undo2 aria-hidden />Revert to draft</DropdownMenuItem>}
                {canRevert && form.eventId && <DropdownMenuSeparator />}
                {form.eventId && <DropdownMenuItem variant="destructive" disabled={form.isSubmitting || form.isDeleting} onSelect={() => { menuOpensDialog.current = true; form.setShowDeleteModal(true); }}><Trash2 aria-hidden />Delete event</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>}
          </div>
        </div>
      </div>
      {published && <Alert variant={form.past ? "neutral" : "info"} className={form.past ? "border-border" : "border-info-foreground"} icon={<Info aria-hidden />}><AlertTitle>{form.canceled ? "This event is canceled" : form.past ? "This event has ended" : "This event is live"}</AlertTitle><AlertDescription>{form.canceled ? `Details are locked. ${historyInfo?.registered ?? 0} registered: ticket holders see it as canceled and can’t check in. Issue refunds in Square. You can still add or change links.` : form.past ? `Details are locked so they match what happened: ${historyInfo?.registered ?? 0} registered, ${historyInfo?.checkedIn ?? 0} checked in. You can still add or change links, like the event recap.` : `Members still see the published version. Your changes go live when you choose Update. ${historyInfo?.registered ?? 0} people are registered.`}</AlertDescription></Alert>}
        <form key={form.resetKey} ref={formElement} onClickCapture={captureInputIssues} onChangeCapture={captureInputIssues} onBlurCapture={captureInputIssues} id="event-builder-form" noValidate className="flex min-w-0 flex-col gap-14 [&_[data-slot=card]:has([data-invalid=true])]:border-destructive [&_input:not([type=checkbox]):not([type=radio])]:h-10 [&_button[data-slot=select-trigger]]:h-10" onSubmit={form.handleSubmit}><fieldset disabled={form.isSubmitting || form.isDeleting} className="flex min-w-0 flex-col gap-14">
          {section("builder-basics", "Basics", <><PrimaryDetailsSection showConfigurationErrors={form.publishAttempted} urlLocked={form.urlLocked} formState={form.formState} onFieldChange={form.handleFieldChange} /><EventBranding state={form.formState} disabled={form.isSubmitting} onChange={form.handleFieldChange} onIcon={form.setPendingImageFile} onHeader={form.setPendingHeaderFile} /><EventFeatured state={form.formState} onChange={form.handleFieldChange} /><EventPricing showErrors={form.publishAttempted} state={form.formState} locked={pricingLocked} effectivePrices={initialEvent && initialEvent.regular_price != null && initialEvent.member_price != null ? { regular: initialEvent.regular_price, member: initialEvent.member_price } : undefined} onChange={form.handleFieldChange} /></>)}
          {section("builder-description", "Description", <EventDescriptionEditor validationManaged key={`${form.resetKey}-${form.legacyDraftRecovered ? "legacy-recovered" : "initial"}`} short={form.formState.short_description} value={form.formState.description} rich={form.formState.description_rich} disabled={form.isSubmitting || form.past} onChange={(short, text, rich) => { form.handleFieldChange("short_description", short); form.handleFieldChange("description", text); form.handleFieldChange("description_rich", rich); }} />)}
          {section("builder-agenda", "Agenda", <EventAgenda enabled={form.formState.agenda_enabled} onEnabledChange={enabled => form.handleFieldChange("agenda_enabled", enabled)} key={form.formState.date_location_revision} value={form.formState.date_location!} disabled={form.isSubmitting} showErrors={form.publishAttempted} onChange={value => form.handleFieldChange("date_location", value)} />)}
          {section("builder-registration", "Registration", <><EventRegistration state={form.formState} disabled={form.isSubmitting} info={registrationInfo} onChange={form.handleFieldChange} /><ApplicationQuestionsSection locked={!!initialApplicationSettings?.questions_locked_at} onMove={form.moveApplicationQuestion} registrationModeOwned enabled={form.formState.requires_application} applicationTemplate={form.applicationTemplate} questionErrors={form.publishAttempted ? form.validation.questionErrors : form.questionErrors} onEnabledChange={enabled => form.handleFieldChange("requires_application", enabled)} onAdd={form.addApplicationQuestion} onRemove={form.removeApplicationQuestion} onUpdate={form.updateApplicationQuestion} onAddResponseOption={form.addResponseOption} onUpdateResponseOption={form.updateResponseOption} onRemoveResponseOption={form.removeResponseOption} />{form.formState.requires_application && <ApplicationTiming state={form.formState} showErrors={form.publishAttempted || visibleIssues.some(issue => issue.section === "registration")} onChange={form.handleFieldChange} />}</>)}
          {section("builder-teams", "Teams", <EventTeams state={form.formState} info={teamInfo} showErrors={form.publishAttempted || visibleIssues.some(issue => issue.section === "teams")} onChange={form.handleFieldChange} />)}
          {section("builder-people", "People and sponsors", <EventPeopleEditor content={form.formState.content ?? emptyContent()} onChange={content => form.handleFieldChange("content", content)} people={mentorOptions} sponsors={sponsorOptions} showErrors={form.showConfigurationErrors} />)}
          {section("builder-resources", "Links and resources", <EventResourcesEditor content={form.formState.content ?? emptyContent()} onChange={content => form.handleFieldChange("content", content)} showErrors={form.showConfigurationErrors} />)}
          {form.error && (
            <Field data-invalid>
              <FieldError>{form.error}</FieldError>
            </Field>
          )}
          {form.successMessage && (
            <Field>
              <FieldDescription className="text-success-foreground">
                {form.successMessage}
              </FieldDescription>
            </Field>
          )}
          <section id="builder-publish" aria-labelledby="builder-publish-heading" style={{ scrollMarginTop: offset + (typeof window !== "undefined" && window.innerWidth < 640 ? 56 : 0) }} className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 basis-72 space-y-1">
                <h2 id="builder-publish-heading" tabIndex={-1} className="text-subheading outline-none focus-visible:focus-ring">{form.canceled ? "Event canceled" : form.past ? "Event ended" : published ? "Published" : scheduled ? "Scheduled" : issues.length ? form.publishAttempted ? "A few things to fix" : "Almost ready" : "Ready to publish"}</h2>
                <p className="text-muted-foreground">{form.canceled ? `${historyInfo?.registered ?? 0} registered. Refunds are issued in Square.` : form.past ? `${historyInfo?.registered ?? 0} registered, ${historyInfo?.checkedIn ?? 0} checked in. Add an event recap link in Links and resources.` : published ? "Members can find this event in the portal. Registration follows its own dates." : scheduled ? `It goes live ${publicationTimeLabel(form.publication.publish_at!)}. You can keep editing until then.` : issues.length ? "Complete the required details before the event goes live. Drafts are only visible to UX Hub execs." : "Everything required is filled in. Choose Publish to go live now or schedule it."}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {(scheduled || published) && <Button disabled={!form.hasUnsavedChanges || form.isDeleting} type="button" loading={form.isSubmitting} onClick={() => void form.handlePublication("save")}>{scheduled ? "Save changes" : "Update"}</Button>}
                {!published && <EventPublishMenu form={form} disabled={!publicationReady} />}
              </div>
            </div>
            {!!issues.length && <div className="space-y-2 border-t border-border-subtle pt-4">
              <h3 className="text-small font-semibold">What’s left</h3>
              {sectionsWithIssues.length > 0 && <ul className="space-y-2">{sectionsWithIssues.map(item => <li key={item.id}><Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-left" onClick={() => focusIssue(issues.find(issue => `builder-${issue.section}` === item.id)!)}>{item.title}{form.publishAttempted ? ` · ${issues.filter(issue => `builder-${issue.section}` === item.id).length} to fix` : ""}</Button></li>)}</ul>}
              {/* Publication timing has no section of its own: it is fixed from the Publish menu beside it. */}
              {publishIssues.length > 0 && <ul className="space-y-1 text-small text-destructive">{publishIssues.map(issue => <li key={issue.message}>{issue.message}</li>)}</ul>}
              {form.publishAttempted && <ul className="space-y-1 text-small text-destructive">{issues.filter(issue => issue.section !== "publish").map((issue, index) => <li key={`${issue.target}-${index}`}><Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-left text-destructive" onClick={() => focusIssue(issue)}>{issue.message}</Button></li>)}</ul>}
            </div>}
          </section>
          </fieldset>
        </form>

      <SectionNavigator title="Event sections" sections={sections} currentId={currentId} numberFormat="plain" placement="bottom-right" className="z-40" />
      <EventPublicationSuccess form={form} />
      {form.eventId && <EventUnpublishDialog eventId={form.eventId} open={revertOpen} pending={form.isSubmitting} error={revertError}
        onOpenChange={open => { if (form.isSubmitting) return; setRevertOpen(open); if (!open) returnFocusToMoreActions(); }}
        onConfirm={() => void form.handlePublication("revert").then(saved => { if (saved) { setRevertOpen(false); returnFocusToMoreActions(); } else setRevertError("The event wasn’t reverted. Your edits are still here."); })} />}
      <EventLeaveDialog eventName={form.formState.name || "Untitled event"} navigation={form.navigation} draft={draft} pending={form.isSubmitting} error={form.error} save={() => form.handleSaveDraft(false)} />
      <Dialog open={form.showDraftSaved} onOpenChange={form.setShowDraftSaved}>
        <DialogContent showCloseButton={false} className="max-w-[482px] gap-4 px-7 pt-11 pb-8">
          <Hubbo emotion="proud" size="hero" className="mx-auto h-50" />
          <DialogHeader className="items-center gap-4 space-y-0 pr-0 text-center sm:text-center">
            <DialogTitle className="pt-2 text-h2">Draft saved</DialogTitle>
            <DialogDescription className="text-body">{form.formState.name || "Untitled event"} is saved as a draft. Only UX Hub execs can see it until you publish.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-3 pt-2 sm:justify-center">
            <Button variant="outline" asChild>
              <Link href="/admin/events"><ArrowLeft aria-hidden />Back to Manage Events</Link>
            </Button>
            <Button type="button" onClick={() => form.setShowDraftSaved(false)}>Keep editing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {form.eventId && (
        <DeleteEventModal
          eventName={initialEvent?.name ?? form.formState.name}
          eventId={form.eventId}
          isOpen={form.showDeleteModal}
          onClose={() => {
            form.setShowDeleteModal(false);
            form.setError(null);
            returnFocusToMoreActions();
          }}
          onConfirm={form.handleDeleteEvent}
          isDeleting={form.isDeleting}
          error={form.error}
        />
      )}
    </div></FieldValidation>
  );
};
