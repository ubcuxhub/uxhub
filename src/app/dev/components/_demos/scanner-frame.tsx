"use client";
import { useState } from "react";
import { Scan, Search, X } from "lucide-react";
import { ScannerFrame, ScannerViewfinder } from "@/components/shared/ScannerFrame";
import { Button } from "@/components/ui/button";
import { Composition } from "@/app/dev/_shell/Specimen";
import { CheckInResultCard } from "@/features/admin/components/CheckInResultCard";
import { CameraProblemPanel } from "@/features/admin/components/QrCameraView";
import { ScanTicketsCard } from "@/features/admin/components/ScanTicketsCard";
import type { ItemCheckInResult } from "@/features/admin/lib/item-check-in";

const EVENT = "Design Sprint 2026";
const RESULTS = {
  "Checked in": { status: "checked_in", name: "Aubrey Ventura", ticketId: "t1", attendanceVersion: "v1", checkedInAt: "2026-11-16T03:42:00Z", checkedCount: 13, total: 46 },
  "Already checked in": { status: "already_checked_in", name: "Iris Chan", ticketId: "t2", attendanceVersion: "v2", checkedInAt: "2026-11-16T03:12:00Z", checkedCount: 12, total: 46 },
  "Ticket not recognized": { status: "rejected", reason: "not_found" },
} satisfies Record<string, ItemCheckInResult>;
type View = "Scanning" | keyof typeof RESULTS | "Camera access is off";
const VIEWS: View[] = ["Scanning", "Checked in", "Already checked in", "Ticket not recognized", "Camera access is off"];

export default function ScannerFrameDemo() {
  const [view, setView] = useState<View | null>(null);
  const checked = view === "Checked in" ? 13 : 12;
  return <>
    <Composition title="Scanner frame" description="Open the full viewport at phone, tablet and desktop widths, in each scanner state. Results are mocked and no camera starts; Checked in returns to scanning after four seconds unless the pointer or focus is inside it.">
      <div className="flex flex-wrap gap-2">{VIEWS.map(name => <Button key={name} variant="secondary" size="sm" onClick={() => setView(name)}>{name}</Button>)}</div>
      {view ? <ScannerFrame header={<>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-h3">Scan tickets</h2>
          <p className="text-small text-muted-foreground">{EVENT} · {checked} of 46 checked in</p>
        </div>
        <Button aria-label="Close preview" size="icon" variant="ghost" onClick={() => setView(null)}><X /></Button>
      </>}>
        {view === "Scanning" ? <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <ScannerViewfinder><p className="flex h-full items-center justify-center p-5 text-small">Camera preview placeholder</p></ScannerViewfinder>
            <p className="text-center text-small">Point the camera at the attendee’s QR code.</p>
            <p className="text-center text-small text-muted-foreground">They’re checked in as soon as the code is read.</p>
          </div>
          <div className="flex justify-end *:flex-1 sm:*:flex-none"><Button variant="secondary"><Search aria-hidden />Search attendees</Button></div>
        </div> : view === "Camera access is off" ? <CameraProblemPanel problem="blocked" onRetry={() => setView("Scanning")} onSearch={() => {}} /> : <CheckInResultCard key={view} result={RESULTS[view]} eventName={EVENT} disabled={false} onNext={() => setView("Scanning")} onSearch={() => setView("Scanning")} onUndo={() => {}} />}
      </ScannerFrame> : null}
    </Composition>
    <Composition title="Scan tickets card" description="The check-in page's way into the scanner. Open scanner on phone hides below the sm breakpoint, where the page is already on a phone.">
      <ScanTicketsCard description="Opening session · Nov 16 · 6:00 PM – 9:00 PM PT">
        <Button><Scan aria-hidden />Scan tickets</Button>
        <Button variant="secondary" className="hidden sm:inline-flex">Open scanner on phone</Button>
      </ScanTicketsCard>
    </Composition>
  </>;
}
