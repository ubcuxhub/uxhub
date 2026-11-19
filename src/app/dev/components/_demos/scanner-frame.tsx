"use client";
import { useState } from "react";
import { ScannerFrame, ScannerViewfinder } from "@/components/shared/ScannerFrame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Composition } from "@/app/dev/_shell/Specimen";
export default function ScannerFrameDemo() {
  const [open,setOpen]=useState(false);
  return <Composition title="Scanner frame" description="Open the full viewport at phone, tablet and desktop widths. The caller owns capture; this example never starts a camera.">
    <Button onClick={()=>setOpen(true)}>Preview scanner frame</Button>
    {open?<ScannerFrame header={<><Button variant="secondary" onClick={()=>setOpen(false)}>Close preview</Button><h2>Scan tickets</h2><Badge>12 of 48 checked in</Badge></>}>
      <p className="text-body-medium">Opening session</p><p className="text-small text-muted-foreground">Sat, Nov 21 · 10:00 AM – 11:00 AM PT</p>
      <div className="flex flex-1 flex-col items-center justify-center gap-6"><ScannerViewfinder><p className="p-5 text-small">Camera preview placeholder</p></ScannerViewfinder><p>Point the camera at the attendee&apos;s QR code.</p><Button variant="secondary">Search attendees</Button></div>
    </ScannerFrame>:null}
  </Composition>;
}
