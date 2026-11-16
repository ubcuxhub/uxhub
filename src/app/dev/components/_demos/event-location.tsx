import { EventLocation } from "@/components/shared/EventLocation";
import { Composition } from "@/app/dev/_shell/Specimen";
import type { ParticipantLocation } from "@/lib/location";

const physical: ParticipantLocation = { type: "in_person", restricted: false, building: "Innovation Center", room: "Studio A", address: "2366 Main Mall, Vancouver", map_url: "https://example.com/map" };
const online: ParticipantLocation = { type: "online", restricted: false, meeting_url: "https://example.com/meeting", meeting_id: "123 456 789", meeting_passcode: "workshop" };
export default function EventLocationDemo() {
  return <div className="space-y-8">{[
    ["Physical", physical], ["Online", online],
    ["Hybrid", { ...physical, ...online, type: "hybrid" }],
    ["Public summary", { type: "hybrid", restricted: true, public_summary: "UBC Vancouver and online" }],
  ].map(([title, location]) => <Composition key={String(title)} title={String(title)} description="Resize to 390/768/1440px, switch theme/density, and check links and copy buttons. The caller supplies a viewer-scoped projection."><EventLocation location={location as ParticipantLocation} /></Composition>)}<Composition title="Compact inherited table location" description="The day header owns full details; the item cell shows building/online and a separate room column."><EventLocation location={{ ...physical, ...online, type: "hybrid" }} showRoom={false} details={false} /></Composition></div>;
}
