"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarX, Search } from "lucide-react";

import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  checkInScannedTicketAction,
  checkInTicketAction,
  fetchAdminCheckInSnapshotAction,
} from "@/features/admin/actions";
import { CheckInLookup } from "@/features/admin/components/CheckInLookup";
import { CheckInResultCard } from "@/features/admin/components/CheckInResultCard";
import { QrCameraView } from "@/features/admin/components/QrCameraView";
import { defaultCheckInSessionId } from "@/features/admin/lib/check-in-sessions";
import type {
  CheckInAttendee,
  CheckInResult,
  CheckInSession,
} from "@/features/admin/types";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { formatEventTime } from "@/lib/date";

// After "Scan next", the ticket just checked in is often still in view. Its
// code is ignored for this long so it doesn't come back as "Already checked in".
const SAME_CODE_GRACE_MS = 3000;

type Status =
  | { kind: "scanning" }
  | { kind: "checking" }
  | { kind: "done"; result: CheckInResult };

interface CheckInScannerProps {
  eventId: string;
  eventName: string;
  sessions: CheckInSession[];
  initialAttendees: CheckInAttendee[];
  /** A QR code linking to this page, shown on a laptop. */
  phoneLink: ReactNode;
}

function sessionLabel(session: CheckInSession): string {
  const start = formatEventTime(session.start_time);
  return start ? `${session.name} · ${start}` : session.name;
}

/**
 * The door scanner: each scanned code (or person picked by name) checks in
 * once, and the camera waits on the result until the admin taps "Scan next".
 * On a laptop it asks to be opened on a phone instead. That is a convenience,
 * not access control; the page and the actions both require an admin.
 */
export function CheckInScanner({
  eventId,
  eventName,
  sessions,
  initialAttendees,
  phoneLink,
}: CheckInScannerProps) {
  const coarsePointer = useCoarsePointer();
  const sessionSelectId = useId();
  const [sessionId, setSessionId] = useState(() =>
    defaultCheckInSessionId(sessions, new Date())
  );
  const [attendees, setAttendees] = useState(initialAttendees);
  const [mode, setMode] = useState<"scan" | "lookup">("scan");
  const [status, setStatus] = useState<Status>({ kind: "scanning" });
  // Refs, not state: the camera can read a code again before React re-renders.
  const busyRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const resumedAtRef = useRef(0);

  const checkInPath = `/admin/events/${eventId}/check-in`;

  async function submit(checkIn: (sessionId: string) => Promise<CheckInResult>) {
    if (busyRef.current || !sessionId) return;
    busyRef.current = true;
    setStatus({ kind: "checking" });

    try {
      setStatus({ kind: "done", result: await checkIn(sessionId) });
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Couldn't check in", {
        description: "Check your connection and try again.",
      });
      lastCodeRef.current = null;
      busyRef.current = false;
      setStatus({ kind: "scanning" });
    }
  }

  function handleScan(code: string) {
    const repeat =
      code === lastCodeRef.current &&
      Date.now() - resumedAtRef.current < SAME_CODE_GRACE_MS;
    if (busyRef.current || repeat) return;

    lastCodeRef.current = code;
    void submit((session) => checkInScannedTicketAction(session, code));
  }

  function handlePick(attendee: CheckInAttendee) {
    lastCodeRef.current = null;
    void submit((session) => checkInTicketAction(session, attendee.id));
  }

  function handleNext() {
    busyRef.current = false;
    resumedAtRef.current = Date.now();
    setMode("scan");
    setStatus({ kind: "scanning" });
  }

  function openLookup() {
    setMode("lookup");
    // Tickets bought since the page loaded should be findable too.
    fetchAdminCheckInSnapshotAction(eventId)
      .then((snapshot) => setAttendees(snapshot.attendees))
      .catch((error: unknown) => console.error("Error refreshing attendees:", error));
  }

  if (sessions.length === 0) {
    return (
      <PageContainer backHref={checkInPath} backLabel="Back to check-in">
        <EmptyState
          size="page"
          icon={<CalendarX />}
          title="No check-in sessions"
          description="Add a check-in session to this event before scanning tickets."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer backHref={checkInPath} backLabel="Back to check-in">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div>
          <h1 className="text-h2">Scan tickets</h1>
          <p className="text-small text-muted-foreground">{eventName}</p>
        </div>

        {coarsePointer === false ? (
          <EmptyState
            size="page"
            media={phoneLink}
            title="Open this on your phone"
            description="The scanner uses your phone's camera. Scan this code with your phone to open it there."
            actions={
              <Button variant="secondary" size="sm" asChild>
                <Link href={checkInPath}>Back to check-in</Link>
              </Button>
            }
          />
        ) : coarsePointer ? (
          <>
            <Field>
              <FieldLabel htmlFor={sessionSelectId}>Session</FieldLabel>
              <Select value={sessionId ?? undefined} onValueChange={setSessionId}>
                <SelectTrigger id={sessionSelectId}>
                  <SelectValue placeholder="Pick a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {sessionLabel(session)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {status.kind === "done" ? (
              <CheckInResultCard result={status.result} onNext={handleNext} />
            ) : status.kind === "checking" ? (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted">
                <Spinner size="lg" label="Checking the ticket" />
              </div>
            ) : mode === "lookup" ? (
              <CheckInLookup
                attendees={attendees}
                onPick={handlePick}
                onCancel={() => setMode("scan")}
              />
            ) : null}

            {mode === "scan" ? (
              // Kept mounted while a result shows, so "Scan next" resumes the
              // same camera instead of starting a new one.
              <div hidden={status.kind !== "scanning"}>
                <QrCameraView
                  paused={status.kind !== "scanning"}
                  onScan={handleScan}
                />
              </div>
            ) : null}

            {mode === "scan" && status.kind === "scanning" ? (
              <Button variant="secondary" onClick={openLookup}>
                <Search aria-hidden />
                Can&apos;t scan?
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
