"use client";

import { CircleAlert } from "lucide-react";
import { eventSlugError, suggestedEventSlug, websiteUrlError } from "../../lib/event-configuration";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldSet, FieldLegend, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { EventFormState } from "./event-form-schema";

export function EventMarketing({ state, urlLocked, onChange, showErrors = false }: {
  state: EventFormState;
  urlLocked: boolean;
  showErrors?: boolean;
  onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;
}) {
  const slugError = showErrors ? eventSlugError(state.slug_edited ? state.page_slug : state.page_slug || suggestedEventSlug(state.name)) : null;
  const websiteError = showErrors ? websiteUrlError(state.marketing_url) : null;
  const errorMessage = (error: string | null) => error && <FieldError><span className="flex items-start gap-1.5"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</span></FieldError>;
  return <div className="@container/marketing space-y-4 rounded-lg border border-border-subtle bg-section px-5 py-4">
    <Field orientation="horizontal"><FieldContent><FieldLabel htmlFor="marketing-enabled">Marketing page</FieldLabel><FieldDescription>A public page about the event, separate from the event overview in the portal.</FieldDescription></FieldContent><Switch id="marketing-enabled" checked={state.marketing_mode !== "disabled"} onCheckedChange={enabled => onChange("marketing_mode", enabled ? "hosted" : "disabled")} /></Field>
    {state.marketing_mode !== "disabled" && <>
      <FieldSet><FieldLegend variant="label">Where the page lives</FieldLegend><RadioGroup aria-label="Where the page lives" value={state.marketing_mode} onValueChange={value => onChange("marketing_mode", value as "hosted" | "external")} className="grid gap-4 @min-[34rem]/marketing:grid-cols-2">
        {[{ value: "hosted", title: "On ubcuxhub.ca", note: "We build the page from this event’s details." }, { value: "external", title: "Another website", note: "Link to a page you already have. E.g. Luma, Devpost or a partner’s site." }].map(option => <FieldLabel key={option.value} htmlFor={`marketing-${option.value}`} className="bg-card has-[>[data-slot=field]]:rounded-lg [&>*]:data-[slot=field]:p-3"><Field orientation="horizontal"><RadioGroupItem id={`marketing-${option.value}`} value={option.value} className="mt-0.5" /><FieldContent><FieldTitle>{option.title}</FieldTitle><FieldDescription>{option.note}</FieldDescription></FieldContent></Field></FieldLabel>)}
      </RadioGroup></FieldSet>
      {state.marketing_mode === "hosted" ? <Field data-invalid={!!slugError || undefined}><FieldLabel htmlFor="event-page-slug">Page URL</FieldLabel><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="text-small text-muted-foreground">https://ubcuxhub.ca/events/</span><Input id="event-page-slug" className="min-h-11 min-w-0 flex-1 basis-48 sm:min-h-10" value={state.page_slug} readOnly={urlLocked} onChange={event => { onChange("page_slug", event.target.value); }} placeholder="design-sprint-2026" /></div><FieldDescription>{urlLocked ? "The page URL is locked after first publication." : "Made from the event name. You can edit it."}</FieldDescription>{errorMessage(slugError)}</Field>
        : <Field data-invalid={!!websiteError || undefined}><FieldLabel htmlFor="event-website">Website URL</FieldLabel><Input id="event-website" className="min-h-11 sm:min-h-10" type="url" value={state.marketing_url} onChange={event => onChange("marketing_url", event.target.value)} placeholder="https://example.com/event" />{errorMessage(websiteError)}</Field>}
    </>}
    <p className="text-small text-muted-foreground">Save this configuration for the marketing integration. Public pages and existing website links keep their current behaviour.</p>
  </div>;
}

export function EventFeatured({ state, onChange }: { state: EventFormState; onChange: (field: "is_featured", value: boolean) => void }) {
  return <div className="rounded-xl border border-border bg-card p-5"><Field orientation="horizontal"><FieldContent><FieldLabel htmlFor="event-featured">Feature on the portal home</FieldLabel><FieldDescription>Save this choice for the portal home integration. It does not add the event to Home yet.</FieldDescription></FieldContent><Switch id="event-featured" checked={state.is_featured} onCheckedChange={value => onChange("is_featured", value)} /></Field></div>;
}
