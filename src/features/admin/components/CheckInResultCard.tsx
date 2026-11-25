"use client";
import { useEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { CircleAlert, CircleCheck, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ItemCheckInResult } from "@/features/admin/lib/item-check-in";
import { formatEventTime } from "@/lib/date";
import { CheckInPanel } from "./CheckInPanel";

/** How long a fresh check-in stays up before the scanner returns by itself. */
export const AUTO_RETURN_SECONDS = 4;

export function rejectionTitle(result: Extract<ItemCheckInResult, { status: "rejected" }>) {
  if (result.reason === "event_canceled") return "This event is canceled";
  if (result.reason === "payment_pending") return "Payment still processing";
  return "Ticket not recognized";
}

interface CheckInResultCardProps {
  result: ItemCheckInResult;
  eventName: string;
  /** Turns off Undo check-in (offline, refreshing, lost access). */
  disabled: boolean;
  /** Holds the countdown, e.g. while the undo confirmation is open. */
  holding?: boolean;
  /** `auto` when the countdown ran out, `user` for Scan next. */
  onNext: (source: "auto" | "user") => void;
  onSearch: () => void;
  onUndo: () => void;
}

/**
 * The outcome of one scan or lookup, shown where the camera was. A fresh
 * check-in returns to scanning after four seconds; the countdown holds while
 * the pointer or focus is inside, so nobody loses Undo mid-reach. Other
 * outcomes wait for Scan next.
 */
export function CheckInResultCard({ result, eventName, disabled, holding = false, onNext, onSearch, onUndo }: CheckInResultCardProps) {
  const autoReturn = result.status === "checked_in";
  const [remaining, setRemaining] = useState(AUTO_RETURN_SECONDS);
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const paused = holding || pointerInside || focusInside;
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  });
  useEffect(() => {
    if (!autoReturn || paused)
      return;
    const interval = setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(interval);
  }, [autoReturn, paused]);
  useEffect(() => {
    if (autoReturn && remaining === 0)
      onNextRef.current("auto");
  }, [autoReturn, remaining]);
  const leave = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      setFocusInside(false);
  };
  const scanNext = <Button onClick={() => onNext("user")}>Scan next</Button>;
  const name = "name" in result ? <p className="text-body-medium [overflow-wrap:anywhere]">{result.name}</p> : null;

  let panel;
  if (result.status === "rejected") {
    const canceled = result.reason === "event_canceled";
    panel = <CheckInPanel tone="error" icon={<TriangleAlert />} title={rejectionTitle(result)} actions={<>
      {/* A canceled event refuses lookups too, so only the scan is offered. */}
      {canceled ? null : <Button variant="secondary" onClick={onSearch}><Search aria-hidden />Search attendees</Button>}{scanNext}
    </>}>
      <p className="max-w-sm text-small text-muted-foreground [overflow-wrap:anywhere]">
        {canceled ? "Canceled events don’t take check-ins." : result.reason === "payment_pending" ? "This ticket’s payment hasn’t gone through yet, so it can’t be checked in. Ask the attendee to check their purchases, or try again in a few minutes." : `This QR code isn’t a ticket for ${eventName}. Ask the attendee to open their ticket in the portal, or find them by name.`}
      </p>
    </CheckInPanel>;
  }
  else if (result.status === "checked_in")
    panel = <CheckInPanel tone="success" icon={<CircleCheck />} title="Checked in" actions={<>
      <Button variant="secondary" disabled={disabled} onClick={onUndo}>Undo check-in</Button>{scanNext}
    </>}>
      {name}
      <p className="text-small text-muted-foreground">
        Checked in at {formatEventTime(result.checkedInAt)} · {paused ? "Next scan paused" : `Next scan in ${remaining} ${remaining === 1 ? "second" : "seconds"}`}
      </p>
    </CheckInPanel>;
  else
    panel = <CheckInPanel tone="warning" icon={<CircleAlert />} title="Already checked in" actions={scanNext}>
      {name}
      <p className="max-w-sm text-small text-muted-foreground">
        This ticket was checked in at {formatEventTime(result.checkedInAt)}. Nothing changed, so the count stays the same.
      </p>
    </CheckInPanel>;
  return <div className="flex flex-col" onPointerEnter={() => setPointerInside(true)} onPointerLeave={() => setPointerInside(false)} onFocus={() => setFocusInside(true)} onBlur={leave}>
    {panel}
  </div>;
}
