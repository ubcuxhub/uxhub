"use client";

import { useId, useState } from "react";
import { LocationEditor } from "@/components/shared/LocationEditor";
import { Composition } from "@/app/dev/_shell/Specimen";
import type { LocationDraft } from "@/lib/location";

function Example({ restricted = false }: { restricted?: boolean }) {
  const prefix = useId();
  const [value, setValue] = useState<LocationDraft>({ type: "in_person", building: "AMS Student Nest", room: "Room 2306", address: "6133 University Boulevard, Vancouver", map_url: "", meeting_url: "https://example.com/meeting", meeting_id: "123 456", meeting_passcode: "demo", public_summary: "UBC Vancouver" });
  return <LocationEditor prefix={prefix} value={value} onChange={setValue} restricted={restricted} />;
}
export default function LocationEditorDemo() {
  return <div className="space-y-8"><Composition title="Public location" description="Switch between all three types: inactive physical and meeting values stay intact. Check keyboard access, wrapping at 390/768/1440px and both themes/densities."><Example /></Composition><Composition title="Restricted location" description="The public summary is separate from physical/meeting details. This component collects fields; the caller must enforce privacy at the data boundary."><Example restricted /></Composition></div>;
}
