"use client";

import { useEffect, useId, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { EventRow } from "@/lib/supabase/models";
import { cancelEventAction, loadEventLifecycleCountsAction } from "../event-overview-actions";

const NOTE_LIMIT = 1000;

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** The refund line: how many paid tickets staff need to refund in Square. */
export function refundReminder(paidTickets: number | null) {
  if (paidTickets === null) return "Checking paid tickets…";
  if (paidTickets === 0) return "No paid tickets need a refund.";
  return `${count(paidTickets, "paid ticket needs", "paid tickets need")} a refund. Issue refunds in Square; canceling doesn’t refund anyone.`;
}

interface CancelEventDialogProps {
  eventId: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gets the canceled event once the database has saved it. */
  onCanceled: (event: EventRow) => void;
}

/**
 * Cancels a published event for good (docs/event-states.md, "Canceled
 * events"), with an optional note ticket holders see. Says that it can't be
 * undone, that nobody is emailed, and how many paid tickets to refund in
 * Square. One attempt key per open, so a retry after a lost response returns
 * the first result.
 */
export function CancelEventDialog({
  eventId,
  eventName,
  open,
  onOpenChange,
  onCanceled,
}: CancelEventDialogProps) {
  const noteId = useId();
  const [note, setNote] = useState("");
  const [paidTickets, setPaidTickets] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<{ note: string; id: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void loadEventLifecycleCountsAction(eventId)
      .then((counts) => {
        if (active) setPaidTickets(counts?.paidTickets ?? 0);
      })
      .catch(() => {
        if (active) setError("Couldn’t count paid tickets. Check the attendee list before you refund.");
      });
    return () => {
      active = false;
      setPaidTickets(null);
      setError(null);
      setNote("");
      operation.current = null;
    };
  }, [open, eventId]);

  const cancel = async () => {
    const trimmed = note.trim();
    if (operation.current?.note !== trimmed) operation.current = { note: trimmed, id: crypto.randomUUID() };
    setPending(true);
    setError(null);
    try {
      const result = await cancelEventAction(eventId, { note: trimmed || null, operationId: operation.current.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCanceled(result.event);
    } catch {
      setError("Couldn’t cancel the event. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel ${eventName}?`}
      description="This can’t be undone. Ticket holders keep the event in their portal, marked canceled, but can’t check in. Registration, applications and teams close. Nobody is emailed."
      confirmLabel="Cancel event"
      pendingLabel="Canceling…"
      cancelLabel="Keep event"
      error={error}
      pending={pending}
      onConfirm={() => void cancel()}
    >
      <p role="status" className="text-small text-foreground">
        {refundReminder(paidTickets)}
      </p>
      <Field>
        <FieldLabel htmlFor={noteId}>Note to attendees (optional)</FieldLabel>
        <Textarea
          id={noteId}
          value={note}
          maxLength={NOTE_LIMIT}
          showCount
          disabled={pending}
          placeholder="E.g. We’ll run this workshop again in January."
          onChange={(event) => setNote(event.target.value)}
        />
        <FieldDescription>Shown on the event page to everyone who can see it.</FieldDescription>
      </Field>
    </ConfirmDialog>
  );
}
