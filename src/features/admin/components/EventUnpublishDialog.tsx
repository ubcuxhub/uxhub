"use client";

import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EventLifecycleCounts } from "@/lib/supabase-helpers/event-lifecycle";
import { loadEventLifecycleCountsAction } from "../event-overview-actions";

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** Why the database will refuse the revert (guard_event_unpublish). */
export function unpublishRefusal(registered: number) {
  return `${count(registered, "person is", "people are")} registered. Cancel the event instead.`;
}

/** What reverting takes away, for the confirmation. */
export function unpublishConsequence(memberApplications: number) {
  const applications = memberApplications
    ? ` ${count(memberApplications, "member application", "member applications")} (submitted, waitlisted or draft) will lose access until you publish it again.`
    : "";
  return `Members won’t see this event until you publish it again.${applications}`;
}

interface EventUnpublishDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs the revert; the dialog stays open, so close it once that succeeds. */
  onConfirm: () => void;
  pending?: boolean;
  error?: string | null;
}

/**
 * The confirmation before an active event goes back to Draft, from the
 * drawer's status select or the builder's Revert (docs/event-states.md,
 * "Unpublishing"). It checks first: while members are registered the database
 * refuses, so this says to cancel instead and offers no revert.
 */
export function EventUnpublishDialog({
  eventId,
  open,
  onOpenChange,
  onConfirm,
  pending = false,
  error,
}: EventUnpublishDialogProps) {
  const [counts, setCounts] = useState<EventLifecycleCounts | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void loadEventLifecycleCountsAction(eventId)
      .then((value) => {
        if (!active) return;
        setCounts(value);
        setFailure(value ? null : "This event no longer exists.");
      })
      .catch(() => {
        if (active) setFailure("Couldn’t check registrations. Try again.");
      });
    return () => {
      active = false;
      setCounts(null);
      setFailure(null);
    };
  }, [open, eventId, attempt]);

  if (!counts || counts.registered > 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{counts ? "This event can’t go back to Draft" : "Revert to draft?"}</DialogTitle>
            <DialogDescription role="status">
              {counts
                ? `${unpublishRefusal(counts.registered)} They’d lose their event page and ticket.`
                : failure ?? "Checking registrations…"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {failure ? <Button onClick={() => setAttempt((value) => value + 1)}>Try again</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Revert to draft?"
      description={unpublishConsequence(counts.memberApplications)}
      confirmLabel="Revert to draft"
      pendingLabel="Reverting…"
      cancelLabel="Keep published"
      error={error}
      pending={pending}
      onConfirm={onConfirm}
    />
  );
}
