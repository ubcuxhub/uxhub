"use client";
import { useEffect, useState } from "react";
import { CircleAlert, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import type { ItemCheckInResult } from "@/features/admin/lib/item-check-in";
import { formatEventTime } from "@/lib/date";

export function CheckInResultCard({ result, eventName, targetLabel, onNext, onSearch, onUndo, disabled }: { result: ItemCheckInResult; eventName: string; targetLabel: string; onNext: () => void; onSearch: () => void; onUndo: () => void; disabled: boolean }) {
  const [remaining, setRemaining] = useState(result.status === "rejected" ? 0 : 4);
  useEffect(() => {
    if (result.status === "rejected")
      return;

    const interval = setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);

    return () => clearInterval(interval);
  }, [result.status]);
  const rejected = result.status === "rejected";
  return <Sheet open onOpenChange={open => {
    if (!open)
      onNext();
  }}>
    <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-h-[85dvh] max-w-[480px] overflow-y-auto rounded-t-2xl" onEscapeKeyDown={e => {
      if (remaining > 0)
        e.preventDefault();
    }} onInteractOutside={e => {
      if (remaining > 0)
        e.preventDefault();
    }}>
      <SheetHeader className="gap-3 p-5">
        <div>{result.status === "checked_in" ? <StatusBadge status="checked_in" /> : result.status === "already_checked_in" ? <Badge variant="warning">
          <History aria-hidden />Already checked in</Badge> : <Badge variant="error">
          <CircleAlert aria-hidden />Ticket not recognized</Badge>}</div>
        <SheetTitle className="text-h2 [overflow-wrap:anywhere]">{rejected ? "Ticket not recognized" : result.name}</SheetTitle>
        <SheetDescription>{rejected ? `This QR code isn't a ticket for ${eventName}. Ask the attendee to open their ticket in the portal, or find them by name.` : `${eventName} · ${result.status === "already_checked_in" ? "Already checked in" : "Checked in"} at ${formatEventTime(result.checkedInAt)}`}</SheetDescription>
        <p className="text-small text-muted-foreground [overflow-wrap:anywhere]">{targetLabel}</p>
      </SheetHeader>
      {!rejected ? <div className="mx-5 flex flex-wrap justify-between gap-3 border-t border-border-subtle pt-5 text-small">
        <span>{result.checkedCount} of {result.total} checked in</span>
        <span className="text-muted-foreground">{remaining ? `Next scan in ${remaining} seconds` : "Ready for the next scan"}</span>
      </div> : null}
      <SheetFooter className="flex-row gap-3 p-5">
        {result.status === "checked_in" ? <Button variant="secondary" disabled={disabled} onClick={onUndo} className="flex-1">Undo check-in</Button> : rejected ? <Button variant="secondary" onClick={onSearch} className="flex-1">Search attendees</Button> : null}
        <Button disabled={remaining > 0} onClick={onNext} className="flex-1">Scan next</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>;
}
