"use client";

import Link from "next/link";
import { Calendar, Link as LinkIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createVolunteerScheduleAction } from "@/features/admin/volunteer-schedule-actions";
import { safeStaffScheduleUrl } from "@/features/admin/lib/event-content";

export function VolunteerScheduleButton({ eventId, initialUrl }: { eventId: string; initialUrl: string | null }) {
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const url = savedUrl ?? initialUrl;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const operation = useRef<{ url: string; id: string } | null>(null);
  const control = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  async function save() {
    if (saving.current) return;
    if (value.length > 5000 || !safeStaffScheduleUrl(value)) {
      setError("Enter an absolute HTTPS URL without a username or password.");
      input.current?.focus();
      return;
    }
    saving.current = true;
    setPending(true);
    setError(null);
    if (operation.current?.url !== value) operation.current = { url: value, id: crypto.randomUUID() };
    try {
      const result = await createVolunteerScheduleAction({ eventId, url: value, operationId: operation.current.id });
      if (!result.ok) { setError(result.error); return; }
      setSavedUrl(result.url);
      setOpen(false);
      operation.current = null;
    } catch {
      setError("Couldn’t save the link. Your URL is still here. Try saving again.");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return <div ref={control} className="min-w-0">
    {url ? <Button asChild variant="secondary" className="w-full sm:h-(--size-control) sm:w-auto"><a href={url} target="_blank" rel="noopener noreferrer"><Calendar aria-hidden />View Volunteer Schedule</a></Button>
      : <Button variant="secondary" className="w-full sm:h-(--size-control) sm:w-auto" onClick={() => { setValue(""); setError(null); setOpen(true); }}><LinkIcon aria-hidden />Add Exec Volunteer Schedule</Button>}
    <Dialog open={open} onOpenChange={next => { if (!saving.current) setOpen(next); }}>
      <DialogContent closeDisabled={pending} onCloseAutoFocus={event => { event.preventDefault(); control.current?.querySelector<HTMLElement>("button, a")?.focus(); }}>
        <DialogHeader><DialogTitle>Link volunteer schedule for the event</DialogTitle><DialogDescription>Keep track of who&apos;s doing what</DialogDescription></DialogHeader>
        <form noValidate className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
          <Field>
            <FieldLabel htmlFor={id}>Volunteer schedule URL</FieldLabel>
            <Input ref={input} id={id} type="url" placeholder="Eg. Notion volunteer sign up page" value={value} disabled={pending} onChange={event => setValue(event.target.value)} />
            <FieldDescription>To change this link later, use the <Link href={`/admin/events/${eventId}/edit#builder-resources`} aria-disabled={pending || undefined} tabIndex={pending ? -1 : undefined} onClick={event => { if (saving.current) event.preventDefault(); }}>event editor</Link>.</FieldDescription>
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter><Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={pending}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
