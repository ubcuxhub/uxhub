"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loadAdminEventDeletionInfoAction } from "@/features/admin/actions";

type DeletionInfo = NonNullable<Awaited<ReturnType<typeof loadAdminEventDeletionInfoAction>>>;
interface DeleteEventModalProps {
  eventId: string;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  error?: string | null;
}

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** Why the database will refuse the delete (delete_event_before_safe_mutations). */
export function deletionRefusal(blockers: DeletionInfo["blockers"]) {
  const members = [
    blockers.memberTickets ? `${count(blockers.memberTickets, "member is", "members are")} registered` : null,
    blockers.memberOffers ? `${count(blockers.memberOffers, "member holds an offer", "members hold offers")}` : null,
    blockers.memberPendingPurchases ? `${count(blockers.memberPendingPurchases, "member payment is", "member payments are")} in progress` : null,
  ].filter(Boolean);
  const reasons = [
    members.length ? `${members.join(", ")}.` : null,
    blockers.livePurchases ? "Some purchases aren’t failed, canceled or refunded." : null,
  ].filter(Boolean);
  return `${reasons.join(" ")} Free staff test registrations on a draft don’t count. Nothing has been deleted.`;
}

export function DeleteEventModal({ eventId, eventName, isOpen, onClose, onConfirm, isDeleting = false, error }: DeleteEventModalProps) {
  const [info, setInfo] = useState<DeletionInfo | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void loadAdminEventDeletionInfoAction(eventId).then(value => {
      if (!active) return;
      setInfo(value);
      setFailure(value ? null : "This event no longer exists.");
    }).catch(() => { if (active) setFailure("Couldn’t check deletion protections. Try again."); });
    return () => { active = false; setInfo(null); setFailure(null); };
  }, [isOpen, eventId, attempt]);
  if (!info || info.blocked) return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>{info?.blocked ? "This event can’t be deleted" : "Delete event?"}</DialogTitle><DialogDescription role="status">{info ? deletionRefusal(info.blockers) : failure ?? "Checking registrations, teams and payment protections…"}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>{failure && <Button onClick={() => setAttempt(value => value + 1)}>Try again</Button>}</DialogFooter></DialogContent>
  </Dialog>;
  return <ConfirmDialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }} title="Delete event?"
    description={`This will permanently remove ${info.name || eventName}, its registrations and its teams. This can’t be undone. ${info.registered} people are registered and ${info.teams} teams exist. No emails or refunds will be sent.`}
    confirmLabel="Delete event" cancelLabel="Cancel" pendingLabel="Deleting…" error={error} pending={isDeleting} onConfirm={onConfirm} />;
}
