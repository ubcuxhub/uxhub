"use client";

import type { EventApplicationSettingsRow } from "@/lib/supabase/models";
import { EventTeams } from "./event-form/EventTeams";
import { EventSchedule } from "./event-form/EventSchedule";
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
import type { EventWorkingDocument } from "../lib/event-working-document";
import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
  MentorRow,
  SponsorRow,
} from "@/lib/supabase/models";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  FieldValidation,
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { useEventForm } from "@/features/admin/hooks/use-event-form";
import { PrimaryDetailsSection } from "./event-form/PrimaryDetailsSection";
import { EventDateLocation } from "./event-form/EventDateLocation";
import { EventRegistration } from "./event-form/EventRegistration";
import { type EventDateLocationDraft } from "../lib/event-date-location";
import { EventPeopleEditor, EventResourcesEditor } from "./event-form/EventPeopleResources";
import { emptyContent, type EventContent } from "../lib/event-content";
import { ApplicationQuestionsSection } from "./event-form/ApplicationQuestionsSection";
import { EventFormSkeleton } from "./event-form/EventFormSkeleton";
import { DeleteEventModal } from "./DeleteEventModal";

interface EventCreateModifyProps {
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
    section: (control.closest("[data-builder-section]")?.id.replace("builder-", "") ?? "summary") as EventFormIssue["section"],
    target: control.id || control.closest("[data-builder-section]")?.id || "builder-summary",
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
  const [offset, setOffset] = useState(86);
  const [currentId, setCurrentId] = useState("builder-basics");
  const published = form.publication.status === "active";
  const scheduled = !!form.publication.publish_at;
  const draft = !published && !scheduled;
  const publicationBlocked = initialEvent?.pricing_policy === "figma_pending" || (!initialEvent && form.formState.pricing_mode !== "legacy");
  const issueSections = ["basics", "description", "dates", "registration", "teams", "schedule", "people", "resources", "summary", "settings"];
  const issues = [...new Map([...form.validation.issues, ...inputIssues].map(issue => [`${issue.section}:${issue.target}`, issue])).values()].sort((a, b) => issueSections.indexOf(a.section) - issueSections.indexOf(b.section));
  const visibleIssues = issues.filter(issue => form.publishAttempted || !issue.required);
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
    "builder-dates": { number: 3, description: "Every day the event runs, where it happens, and who sees the details." },
    "builder-registration": { number: 4, description: "How members sign up, how many can and how they check in." },
    "builder-teams": { number: 5, description: "Team events show a Your Team card with an invite link on the event page." },
    "builder-people": { number: 7 },
    "builder-schedule": { number: 6, description: "Shown as the agenda on the event page." },
    "builder-resources": { number: 8, description: "Community links, files and the event recap for this event." },
    "builder-summary": { number: 9, description: "What’s left before the event can go live. Drafts are only visible to staff." },
    "builder-settings": { number: 10, description: "Actions that affect the whole event." },
  };
  const sections: NavigatorSection[] = [
    { id: "builder-basics", number: 1, title: "Basics", state: "complete", required: true },
    { id: "builder-description", number: 2, title: "Description", state: "complete", required: true },
    { id: "builder-dates", number: 3, title: "Date and location", state: "complete", required: true },
    { id: "builder-registration", number: 4, title: "Registration", state: "complete", required: true },
    { id: "builder-teams", number: 5, title: "Teams", state: "complete", required: false },
    { id: "builder-schedule", number: 6, title: "Schedule", state: "complete", required: false },
    { id: "builder-people", number: 7, title: "People and sponsors", state: form.formState.content?.sections.length ? "complete" : "optional", required: false },
    { id: "builder-resources", number: 8, title: "Links and resources", state: form.formState.content?.links.length ? "complete" : "optional", required: false },
    { id: "builder-summary", number: 9, title: "Summary", state: "optional", required: false },
    { id: "builder-settings", number: 10, title: "Other settings", state: "optional", required: false },
  ].map((section): NavigatorSection => {
    const key = section.id.replace("builder-", "");
    const all = issues.filter(issue => issue.section === key);
    const visible = visibleIssues.filter(issue => issue.section === key);
    return { ...section, state: visible.length ? "attention" : all.length ? "not-started" : section.state as NavigatorSection["state"], issues: visible.length || undefined };
  });
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
  const section = (id: string, title: string, children: ReactNode) => (
    <section id={id} data-builder-section style={{ scrollMarginTop: offset + (typeof window !== "undefined" && window.innerWidth < 640 ? 56 : 0) }} className="space-y-4 border-t border-border pt-14 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-2"><div>
        <p className="text-badge text-muted-foreground">Section {sectionDetails[id].number}</p>
        <h2 tabIndex={-1} className="pt-1 text-h3 outline-none focus-visible:focus-ring">{title}</h2>
        {sectionDetails[id].description && <p className="pt-0.5 text-muted-foreground">{sectionDetails[id].description}</p>}
      </div>{visibleIssues.some(issue => `builder-${issue.section}` === id) && <StatusBadge label={`${visibleIssues.filter(issue => `builder-${issue.section}` === id).length} to fix`} tone="error" />}</div>
      {children}
    </section>
  );

  return (
    <FieldValidation errors={visibleIssues}><div className="event-builder flex w-full min-w-0 flex-col gap-6 pb-50">
      <div id="event-builder-header" ref={header} className="sticky top-4 z-20 -mx-5 space-y-2 border-b border-border-subtle bg-background px-5 pb-3.5 sm:-top-10 sm:-mx-6 sm:px-6 min-[821px]:-mx-12 min-[821px]:px-12">
        {showBackButton && <BackButton link="/admin/events" label="Back to Manage Events" className="h-8 w-fit px-4 text-small" />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1 className="break-words text-h2">{form.formState.name || "Untitled event"}</h1>
            <StatusBadge label={scheduled ? "Scheduled" : published ? "Published" : "Draft"} tone={scheduled ? "info" : published ? "success" : "neutral"} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className="text-small text-muted-foreground">{saveStatus}{scheduled ? ` · Goes live ${publicationTimeLabel(form.publication.publish_at!)}` : published ? " · Published" : ""}</span>
            {draft && <Button type="button" size="sm" variant="outline" loading={form.isSubmitting} onClick={() => void form.handleSaveDraft()}>Save draft</Button>}
            {(scheduled || published) && <Button type="button" size="sm" loading={form.isSubmitting} onClick={() => void form.handlePublication("save")}>{scheduled ? "Save changes" : "Update event"}</Button>}
            {!published && <EventPublishMenu form={form} size="sm" />}
          </div>
        </div>
      </div>
      {form.loadingEvent ? (
        <EventFormSkeleton />
      ) : (
        <form ref={formElement} onClickCapture={captureInputIssues} onChangeCapture={captureInputIssues} onBlurCapture={captureInputIssues} id="event-builder-form" noValidate className="flex min-w-0 flex-col gap-14 [&_[data-slot=card]:has([data-invalid=true])]:border-destructive [&_input:not([type=checkbox]):not([type=radio])]:h-10 [&_button[data-slot=select-trigger]]:h-10" onSubmit={form.handleSubmit}><fieldset disabled={form.isSubmitting} className="flex min-w-0 flex-col gap-14">
          {section("builder-basics", "Basics", <><PrimaryDetailsSection showConfigurationErrors={form.publishAttempted} urlLocked={!!initialEvent?.first_published_at || published} formState={form.formState} onFieldChange={form.handleFieldChange} /><EventBranding state={form.formState} disabled={form.isSubmitting} onChange={form.handleFieldChange} onIcon={form.setPendingImageFile} onHeader={form.setPendingHeaderFile} /><EventFeatured state={form.formState} onChange={form.handleFieldChange} /><EventPricing showErrors={form.publishAttempted} state={form.formState} locked={pricingLocked} effectivePrices={initialEvent && initialEvent.pricing_policy !== "figma_pending" ? { regular: initialEvent.regular_price, member: initialEvent.member_price } : undefined} onChange={form.handleFieldChange} /></>)}
          {section("builder-description", "Description", <EventDescriptionEditor validationManaged key={form.legacyDraftRecovered ? "legacy-recovered" : "initial"} short={form.formState.short_description} value={form.formState.description} rich={form.formState.description_rich} disabled={form.isSubmitting} onChange={(short, text, rich) => { form.handleFieldChange("short_description", short); form.handleFieldChange("description", text); form.handleFieldChange("description_rich", rich); }} />)}
          {section("builder-dates", "Date and location", <EventDateLocation key={form.formState.date_location_revision} value={form.formState.date_location!} disabled={form.isSubmitting} showErrors={form.publishAttempted} onChange={value => form.handleFieldChange("date_location", value)} />)}
          {section("builder-registration", "Registration", <><EventRegistration state={form.formState} disabled={form.isSubmitting} info={registrationInfo} onChange={form.handleFieldChange} /><ApplicationQuestionsSection locked={!!initialApplicationSettings?.questions_locked_at} onMove={form.moveApplicationQuestion} registrationModeOwned enabled={form.formState.requires_application} applicationTemplate={form.applicationTemplate} questionErrors={form.publishAttempted ? form.validation.questionErrors : form.questionErrors} onEnabledChange={enabled => form.handleFieldChange("requires_application", enabled)} onAdd={form.addApplicationQuestion} onRemove={form.removeApplicationQuestion} onUpdate={form.updateApplicationQuestion} onAddResponseOption={form.addResponseOption} onUpdateResponseOption={form.updateResponseOption} onRemoveResponseOption={form.removeResponseOption} />{form.formState.requires_application && <ApplicationTiming state={form.formState} showErrors={form.publishAttempted || visibleIssues.some(issue => issue.section === "registration")} onChange={form.handleFieldChange} />}</>)}
          {section("builder-teams", "Teams", <EventTeams state={form.formState} info={teamInfo} showErrors={form.publishAttempted || visibleIssues.some(issue => issue.section === "teams")} onChange={form.handleFieldChange} />)}
          {section("builder-schedule", "Schedule", <EventSchedule enabled={form.formState.agenda_enabled} onChange={enabled => form.handleFieldChange("agenda_enabled", enabled)} />)}
          {section("builder-people", "People and sponsors", <EventPeopleEditor content={form.formState.content ?? emptyContent()} onChange={content => form.handleFieldChange("content", content)} people={mentorOptions} sponsors={sponsorOptions} showErrors={form.showConfigurationErrors} />)}
          {section("builder-resources", "Links and resources", <EventResourcesEditor content={form.formState.content ?? emptyContent()} onChange={content => form.handleFieldChange("content", content)} showErrors={form.showConfigurationErrors} />)}
          {section("builder-summary", "Summary", <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4"><h3 className="text-subheading">{published ? "Published" : scheduled ? "Scheduled" : issues.length ? form.publishAttempted ? "A few things to fix" : "Almost ready" : publicationBlocked ? "Publication unavailable" : "Ready to publish"}</h3>{!published && <EventPublishMenu form={form} />}</div>
            <p className="text-muted-foreground">{published ? "Members can find this event in the portal. Registration follows its own dates." : scheduled ? `It goes live ${publicationTimeLabel(form.publication.publish_at!)}. You can keep editing until then.` : issues.length ? "Complete the required details before the event goes live." : publicationBlocked ? "New pricing is saved as a draft. Publication requires the pricing and free-registration integration." : "Everything required is filled in. Choose Publish to go live now or schedule it."}</p>
            {!!issues.length && <ul className="space-y-2">{sections.filter(item => issues.some(issue => `builder-${issue.section}` === item.id)).map(item => <li key={item.id}><Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-left" onClick={() => focusIssue(issues.find(issue => `builder-${issue.section}` === item.id)!)}>{item.title}{form.publishAttempted ? ` · ${issues.filter(issue => `builder-${issue.section}` === item.id).length} to fix` : ""}</Button></li>)}</ul>}
            {form.publishAttempted && !!issues.length && <ul className="space-y-1 text-small text-destructive">{issues.map((issue, index) => <li key={`${issue.target}-${index}`}><Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-left text-destructive" onClick={() => focusIssue(issue)}>{issue.message}</Button></li>)}</ul>}
            {publicationBlocked && !!issues.length && <p className="text-small text-muted-foreground">New-pricing events remain drafts until the pricing and free-registration integration is available.</p>}
          </div>)}
          {section("builder-settings", "Other settings", <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            {draft && <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 space-y-0.5"><h3 className="text-small font-semibold">Save draft</h3><p className="text-small text-muted-foreground">{saveStatus}. Drafts are only visible to staff.</p></div>
              <Button type="button" variant="outline" loading={form.isSubmitting} onClick={() => void form.handleSaveDraft()}>Save draft</Button>
            </div>}
            {form.eventId && <div className={`flex flex-wrap items-center justify-between gap-4${draft ? " border-t border-border-subtle pt-4" : ""}`}>
              <div className="min-w-0 space-y-0.5"><h3 className="text-small font-semibold">Delete event</h3><p className="text-small text-muted-foreground">Payment protections apply. Deletion can’t be undone.</p></div>
              <Button type="button" variant="outline" disabled={form.isSubmitting || form.isDeleting} onClick={() => form.setShowDeleteModal(true)}>Delete event</Button>
            </div>}
          </div>)}
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
          </fieldset>
        </form>
      )}

      <SectionNavigator title="Event sections" sections={sections} currentId={currentId} numberFormat="plain" className="bottom-4 z-40 sm:right-8 sm:bottom-8 sm:left-auto sm:translate-x-0" />
      <EventPublicationSuccess form={form} />
      <EventLeaveDialog eventName={form.formState.name || "Untitled event"} navigation={form.navigation} draft={draft} pending={form.isSubmitting} error={form.error} save={() => form.handleSaveDraft(false)} />
      <Dialog open={form.showDraftSaved} onOpenChange={form.setShowDraftSaved}>
        <DialogContent showCloseButton={false} className="max-w-[482px] gap-4 px-7 pt-11 pb-8">
          <div aria-label="Hubbo placeholder" className="mx-auto flex size-35 items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center text-caption text-muted-foreground">Hubbo<br />placeholder</div>
          <DialogHeader className="items-center gap-4 space-y-0 pr-0 text-center sm:text-center">
            <DialogTitle className="pt-2 text-h2">Draft saved</DialogTitle>
            <DialogDescription className="text-body">{form.formState.name || "Untitled event"} is saved as a draft. Only staff can see it until you publish.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap items-center gap-3 pt-2 sm:justify-center">
            <BackButton link="/admin/events" label="Back to Manage Events" className="h-8 px-4 text-small" />
            <Button type="button" onClick={() => form.setShowDraftSaved(false)}>Keep editing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {form.eventId && (
        <DeleteEventModal
          eventName={form.formState.name}
          isOpen={form.showDeleteModal}
          onClose={() => {
            form.setShowDeleteModal(false);
            form.setError(null);
          }}
          onConfirm={form.handleDeleteEvent}
          isDeleting={form.isDeleting}
          error={form.error}
        />
      )}
    </div></FieldValidation>
  );
};
