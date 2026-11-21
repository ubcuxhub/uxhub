"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ScannerFrame, ScannerViewfinder } from "@/components/shared/ScannerFrame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { CheckInTarget, checkInItemContext } from "./CheckInTarget";
import { CheckInFeedback } from "./CheckInFeedback";
import { CheckInLookup } from "./CheckInLookup";
import { CheckInResultCard } from "./CheckInResultCard";
import { QrCameraView } from "./QrCameraView";
import { useItemCheckIn } from "@/features/admin/hooks/use-item-check-in";
import { checkInPath, type ItemCheckInResult, type ItemCheckInSnapshot } from "@/features/admin/lib/item-check-in";

export function CheckInScanner({ eventId, eventName, initialItemId, initialSnapshot, returnTo }: { eventId: string; eventName: string; initialItemId: string | null; initialSnapshot: ItemCheckInSnapshot; returnTo?: string }) {
  const state = useItemCheckIn(eventId, initialItemId, initialSnapshot, true, returnTo);
  const [result, setResult] = useState<ItemCheckInResult | null>(null);
  const [lookup, setLookup] = useState(false);
  const epoch = useRef(0);
  const lock = useRef(false);
  const target = state.snapshot.items.find(i => i.id === state.itemId);
  const submit = async (input: { code?: string; ticketId?: string }) => {
    if (lock.current)
      return;
    lock.current = true;
    const captured = epoch.current;
    try {
      const next = await state.mutate(input);
      if (captured === epoch.current && next && (next.status === "checked_in" || next.status === "already_checked_in" || next.status === "rejected"))
        setResult(next);
    }
    catch (e) {
      if (captured === epoch.current)
        toast.error(e instanceof Error ? e.message : "Couldn't check in. Check your connection and try again.");
    }
    finally {
      lock.current = false;
    }
  };
  return <ScannerFrame header={<>
    <div className="flex items-center gap-2">
      <Button aria-label="Close scanner" size="icon" variant="ghost" asChild>
        <Link href={checkInPath(eventId, state.itemId, false, returnTo)}>
          <X />
        </Link>
      </Button>
      <h1 className="text-body-medium">Scan tickets</h1>
    </div>
    <Badge>{state.snapshot.attendance.length} of {state.snapshot.attendees.length} checked in</Badge>
  </>}>
    {state.snapshot.items.length ? <CheckInTarget items={state.snapshot.items} itemId={state.itemId} onChange={id => {
      epoch.current++;
      setResult(null);
      state.selectItem(id);
    }} /> : null}
    <CheckInFeedback state={state} eventId={eventId} />
    {target ? lookup ? <CheckInLookup attendees={state.snapshot.attendees} disabled={!state.enabled} onPick={a => void submit({ ticketId: a.id })} onCancel={() => setLookup(false)} /> : <div className="flex flex-1 flex-col items-center justify-center gap-6">
      {state.enabled && !result ? <QrCameraView key={state.itemId} paused={state.busy} onScan={code => void submit({ code })} onSearch={() => setLookup(true)} /> : <ScannerViewfinder>
        <p role="status" className="flex h-full items-center justify-center px-4 text-center text-small">{state.busy ? "Checking ticket…" : !state.online ? "Reconnect to scan tickets." : result ? "Camera paused" : "Refresh check-in to scan tickets."}</p>
      </ScannerViewfinder>}
      <p className="text-center text-small">Point the camera at the attendee&apos;s QR code.</p>
      <p className="text-center text-small text-muted-foreground">They&apos;ll need to open their ticket in the portal.</p>
      <Button variant="secondary" onClick={() => {
        setLookup(true);
        void state.refresh();
      }}>Search attendees</Button>
    </div> : null}
    {result && target ? <CheckInResultCard key={result.status === "rejected" ? "rejected" : result.attendanceVersion} result={result} eventName={eventName} targetLabel={`${target.label} · ${checkInItemContext(target)}`} onNext={() => { setResult(null); setLookup(false); }} onSearch={() => {
      setResult(null);
      setLookup(true);
    }} disabled={!state.enabled} onUndo={() => {
      if (result.status !== "checked_in")
        return;
      void state.undo({ ticketId: result.ticketId, attendanceVersion: result.attendanceVersion, checkedInAt: result.checkedInAt, operator: null, method: null }).then(() => {
        setResult(null);
        toast.success("Check-in undone");
      }).catch(e => toast.error(e instanceof Error ? e.message : "Couldn't undo check-in. Try again."));
    }} /> : null}
  </ScannerFrame>;
}
