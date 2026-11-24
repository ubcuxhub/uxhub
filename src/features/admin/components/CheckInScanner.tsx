"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { ScannerFrame, ScannerViewfinder } from "@/components/shared/ScannerFrame";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CheckInTarget } from "./CheckInTarget";
import { CheckInFeedback } from "./CheckInFeedback";
import { CheckInLookup } from "./CheckInLookup";
import { CheckInResultCard, rejectionTitle } from "./CheckInResultCard";
import { QrCameraView, type CameraProblem } from "./QrCameraView";
import { useItemCheckIn } from "@/features/admin/hooks/use-item-check-in";
import { checkInPath, type ItemCheckInResult, type ItemCheckInSnapshot } from "@/features/admin/lib/item-check-in";
import { formatEventTime } from "@/lib/date";

/** After a result, the code it came from is ignored this long once scanning resumes, so a ticket still in view doesn't come back as Already checked in. */
export const SAME_CODE_COOLDOWN_MS = 3000;

function announce(result: ItemCheckInResult) {
  if (result.status === "checked_in")
    return `Checked in: ${result.name}. ${result.checkedCount} of ${result.total} checked in.`;
  if (result.status === "rejected")
    return `${rejectionTitle(result)}.`;
  return `Already checked in: ${result.name}, at ${formatEventTime(result.checkedInAt)}. Nothing changed.`;
}

export function CheckInScanner({ eventId, eventName, initialItemId, initialSnapshot, returnTo }: { eventId: string; eventName: string; initialItemId: string | null; initialSnapshot: ItemCheckInSnapshot; returnTo?: string }) {
  const state = useItemCheckIn(eventId, initialItemId, initialSnapshot, true, returnTo);
  const [result, setResult] = useState<ItemCheckInResult | null>(null);
  const [lookup, setLookup] = useState(false);
  const [cameraProblem, setCameraProblem] = useState<CameraProblem | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const epoch = useRef(0);
  const lock = useRef(false);
  /** The code behind the result on screen; `until` is set once scanning resumes. */
  const lastCode = useRef<{ code: string; until: number } | null>(null);
  const scanRegion = useRef<HTMLElement>(null);
  const focusScanRegion = useRef(false);
  const hintId = useId();
  const target = state.snapshot.items.find(i => i.id === state.itemId);
  const checkedCount = state.snapshot.attendance.length;
  const showProblem = state.enabled && cameraProblem !== null;

  useEffect(() => {
    if (result || lookup || !focusScanRegion.current)
      return;
    focusScanRegion.current = false;
    scanRegion.current?.focus();
  }, [result, lookup]);

  const submit = async (input: { code?: string; ticketId?: string }) => {
    if (lock.current)
      return;
    const last = lastCode.current;
    if (input.code !== undefined && last?.code === input.code && Date.now() < last.until)
      return;
    lock.current = true;
    const captured = epoch.current;
    try {
      const next = await state.mutate(input);
      if (captured === epoch.current && next && (next.status === "checked_in" || next.status === "already_checked_in" || next.status === "rejected")) {
        lastCode.current = input.code === undefined ? null : { code: input.code, until: Infinity };
        setResult(next);
        setAnnouncement(announce(next));
      }
    }
    catch (e) {
      if (captured === epoch.current)
        toast.error(e instanceof Error ? e.message : "Couldn't check in. Check your connection and try again.");
    }
    finally {
      lock.current = false;
    }
  };
  /** Leaves the result; `focus` when the person acted from inside it, so focus doesn't drop to the page. */
  const leaveResult = (next: { lookup: boolean; focus: boolean }) => {
    if (lastCode.current)
      lastCode.current = { code: lastCode.current.code, until: Date.now() + SAME_CODE_COOLDOWN_MS };
    setResult(null);
    setLookup(next.lookup);
    setUndoOpen(false);
    setUndoError(null);
    setAnnouncement("");
    focusScanRegion.current = next.focus && !next.lookup;
  };
  const confirmUndo = () => {
    if (result?.status !== "checked_in")
      return;
    if (!state.enabled) {
      setUndoError("Reconnect and refresh before undoing attendance.");
      return;
    }
    const { name, ticketId, attendanceVersion, checkedInAt } = result;
    void state.undo({ ticketId, attendanceVersion, checkedInAt, operator: null, method: null }).then(() => {
      leaveResult({ lookup: false, focus: true });
      toast.success("Check-in undone");
      setAnnouncement(`Check-in undone for ${name}.`);
    }).catch(e => setUndoError(e instanceof Error ? e.message : "Couldn't undo check-in. Try again."));
  };
  const openLookup = () => {
    setLookup(true);
    void state.refresh();
  };

  return <ScannerFrame header={<>
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <h1 className="text-h3">Scan tickets</h1>
      <p className="text-small text-muted-foreground [overflow-wrap:anywhere]">{eventName} · {checkedCount} of {state.snapshot.attendees.length} checked in</p>
    </div>
    <Button aria-label="Close scanner" size="icon" variant="ghost" asChild>
      <Link href={checkInPath(eventId, state.itemId, false, returnTo)}>
        <X />
      </Link>
    </Button>
  </>}>
    {state.snapshot.items.length ? <CheckInTarget items={state.snapshot.items} itemId={state.itemId} onChange={id => {
      epoch.current++;
      lastCode.current = null;
      setResult(null);
      setUndoOpen(false);
      setAnnouncement("");
      state.selectItem(id);
    }} /> : null}
    <CheckInFeedback state={state} eventId={eventId} />
    {!target ? null : result ? <CheckInResultCard key={result.status === "rejected" ? "rejected" : result.attendanceVersion} result={result} eventName={eventName} disabled={!state.enabled} holding={undoOpen} onNext={source => leaveResult({ lookup: false, focus: source === "user" })} onSearch={() => leaveResult({ lookup: true, focus: false })} onUndo={() => {
      setUndoError(null);
      setUndoOpen(true);
    }} /> : lookup ? <CheckInLookup attendees={state.snapshot.attendees} disabled={!state.enabled} onPick={a => void submit({ ticketId: a.id })} onCancel={() => setLookup(false)} /> : <div className="flex flex-1 flex-col gap-4">
      <section ref={scanRegion} tabIndex={-1} aria-labelledby={showProblem ? undefined : hintId} aria-label={showProblem ? "Camera" : undefined} className="flex flex-col items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {state.enabled ? <QrCameraView key={state.itemId} paused={state.busy} onScan={code => void submit({ code })} onSearch={openLookup} onProblemChange={setCameraProblem} /> : <ScannerViewfinder>
          <p role="status" className="flex h-full items-center justify-center px-4 text-center text-small">{state.busy ? "Checking ticket…" : !state.online ? "Reconnect to scan tickets." : "Refresh check-in to scan tickets."}</p>
        </ScannerViewfinder>}
        {showProblem ? null : <>
          <p id={hintId} className="text-center text-small">Point the camera at the attendee’s QR code.</p>
          <p className="text-center text-small text-muted-foreground">They’re checked in as soon as the code is read.</p>
        </>}
      </section>
      {showProblem ? null : <div className="flex justify-end *:flex-1 sm:*:flex-none">
        <Button variant="secondary" onClick={openLookup}><Search aria-hidden />Search attendees</Button>
      </div>}
    </div>}
    <ConfirmDialog open={undoOpen && result?.status === "checked_in"} onOpenChange={open => {
      if (!open)
        setUndoOpen(false);
    }} title="Undo check-in" description={result?.status === "checked_in" ? `${result.name} will go back to Going for ${target?.label}. The checked-in count changes from ${checkedCount} to ${Math.max(0, checkedCount - 1)}. You can check them in again at any time.` : ""} confirmLabel="Undo check-in" confirmVariant="default" pending={state.busy} error={undoError} returnFocusRef={scanRegion} onConfirm={confirmUndo} />
    <p role="status" className="sr-only">{announcement}</p>
  </ScannerFrame>;
}
