"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { strictPacificTimestamp } from "@/lib/date";
import { PublicationPicker } from "./PublicationPicker";
import type { useEventForm } from "../../hooks/use-event-form";

export function publicationTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) + " (PT)";
}

export function scheduleTimeProblem(value: string, closes: string, now = Date.now()) {
  const instant = strictPacificTimestamp(value);
  if (!instant) return "Choose a valid, unambiguous Pacific date and time.";
  if (Date.parse(instant) <= now) return "This time has already passed. Pick a time in the future.";
  const closing = strictPacificTimestamp(closes);
  if (closing && Date.parse(instant) >= Date.parse(closing)) return "Publish time must be before registration closes.";
  return null;
}

type Form = ReturnType<typeof useEventForm>;

/** The two builder entry points share the same actions and persisted lifecycle. */
export function EventPublishMenu({ form, size = "default" }: { form: Form; size?: "sm" | "default" }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [time, setTime] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [inputError, setInputError] = useState<string | null>(null);
  const picker = useRef<HTMLDivElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const actionOwnsFocus = useRef(false);
  const scheduled = !!form.publication.publish_at;
  const error = inputError ?? (attempted ? scheduleTimeProblem(time, form.formState.registration_closes_at, clock) : null);
  return <Popover open={pickerOpen} onOpenChange={open => { if (!form.isSubmitting) setPickerOpen(open); }}>
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverAnchor asChild><DropdownMenuTrigger asChild><Button ref={trigger} type="button" size={size} disabled={form.isSubmitting}>Publish<ChevronDown aria-hidden className="size-4" /></Button></DropdownMenuTrigger></PopoverAnchor>
      {/* Remove the menu during the handoff: its exit animation otherwise leaves
          hoverable items that can steal focus from and dismiss the picker. */}
      {!pickerOpen && <DropdownMenuContent align="end" collisionPadding={20} className="z-40 w-[calc(100vw-40px)] max-w-[calc(100vw-40px)] sm:w-[340px] space-y-0.5 p-2" onCloseAutoFocus={event => { if (pickerOpen || actionOwnsFocus.current) event.preventDefault(); actionOwnsFocus.current = false; }}>
        <DropdownMenuItem className="items-start p-3" onSelect={() => { actionOwnsFocus.current = true; void form.handlePublication("publish"); }}><div><p className="font-semibold">Publish now</p><p className="mt-0.5 text-caption text-muted-foreground">Members can find the event in the portal right away. Registration follows its own dates.</p></div></DropdownMenuItem>
        <DropdownMenuItem className="items-start p-3" onSelect={() => { actionOwnsFocus.current = true; setTime(form.formState.publish_at); setAttempted(false); setInputError(null); setSaveError(null); setPickerOpen(true); }}><div><p className="font-semibold">{scheduled ? "Change scheduled publish time" : "Schedule…"}</p><p className="mt-0.5 text-caption text-muted-foreground">{scheduled ? `Now set for ${publicationTimeLabel(form.publication.publish_at!)}.` : "Pick a date and time for it to go live. You can keep editing until then."}</p></div></DropdownMenuItem>
        {scheduled && <DropdownMenuItem className="items-start p-3" onSelect={() => { actionOwnsFocus.current = true; void form.handlePublication("cancel"); }}><div><p className="font-semibold">Cancel schedule</p><p className="mt-0.5 text-caption text-muted-foreground">Back to a draft. Only staff can see it.</p></div></DropdownMenuItem>}
      </DropdownMenuContent>}
    </DropdownMenu>
    <PopoverContent ref={picker} align="end" sideOffset={8} collisionPadding={20} role="dialog" aria-label="Schedule publishing" className="z-40 w-[440px] max-w-[calc(100vw-40px)] space-y-3 p-5" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} onEscapeKeyDown={event => { if (form.isSubmitting) event.preventDefault(); }} onInteractOutside={event => { if (form.isSubmitting) event.preventDefault(); }}>
      <h3 className="text-small font-semibold">Schedule publishing</h3>
      <p className="text-small text-muted-foreground">The event goes live at this time (Pacific Time). Registration follows the dates set in Registration.</p>
      <PublicationPicker error={error} value={time} disabled={form.isSubmitting} onChange={value => { setTime(value); setClock(Date.now()); setInputError(null); setSaveError(null); }} />
      {saveError && <FieldError>{saveError}</FieldError>}
      <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={form.isSubmitting} onClick={() => setPickerOpen(false)}>Cancel</Button><Button type="button" size="sm" loading={form.isSubmitting} onClick={async () => {
        setClock(Date.now());
        setAttempted(true);
        const invalid = picker.current?.querySelector<HTMLInputElement>("input:invalid");
        if (invalid) { setInputError(invalid.validationMessage); invalid.focus(); return; }
        if (scheduleTimeProblem(time, form.formState.registration_closes_at)) return;
        const saved = await form.handlePublication("schedule", time);
        if (saved) setPickerOpen(false);
        else { setSaveError("Couldn’t schedule the event. Review the form and publication errors; your changes are still here."); }
      }}>{scheduled ? "Save time" : "Schedule"}</Button></div>
    </PopoverContent>
  </Popover>;
}

export function EventPublicationSuccess({ form }: { form: Form }) {
  const saved = form.publicationSuccess;
  const opener = useRef<HTMLElement | null>(null);
  const scheduled = saved?.status === "draft" && !!saved.publish_at;
  const registration = saved?.registration_opens_at && Date.parse(saved.registration_opens_at) > saved.completed_at ? `Registration opens ${publicationTimeLabel(saved.registration_opens_at)}.` : saved?.registration_closes_at && Date.parse(saved.registration_closes_at) <= saved.completed_at ? "Registration has closed." : "Registration is open.";
  return <Dialog open={!!saved} onOpenChange={open => { if (!open) form.setPublicationSuccess(null); }}>
    <DialogContent showCloseButton={false} className="max-w-[482px] gap-4 px-7 pt-11 pb-8" onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null; }} onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); else document.querySelector<HTMLButtonElement>("#event-builder-header button[aria-haspopup=menu], #event-builder-header button")?.focus(); }}>
      <div aria-label="Hubbo placeholder" className="mx-auto flex h-50 w-36 items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center text-caption text-muted-foreground">Hubbo<br />placeholder</div>
      <DialogHeader className="items-center gap-4 space-y-0 pr-0 text-center sm:text-center"><DialogTitle className="text-h2">{scheduled ? "Event scheduled" : "Event published"}</DialogTitle><DialogDescription className="text-body">{scheduled ? `${saved?.name} goes live ${publicationTimeLabel(saved!.publish_at!)}. You can keep editing until then.` : `${saved?.name} is live. Members can find it in the portal. ${registration}`}</DialogDescription></DialogHeader>
      <DialogFooter className="flex-wrap gap-3 pt-2 sm:justify-center"><Button type="button" variant="outline" onClick={() => form.setPublicationSuccess(null)}>Keep editing</Button><Button asChild><a href={saved ? `/admin/events/${saved.id}` : "#"}>View event page</a></Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
