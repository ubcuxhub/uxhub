import { Button } from "@/components/ui/button";
import { CopyCode } from "@/components/shared/CopyCode";
import type { ParticipantLocation } from "@/lib/location";

function safeLink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? value : null;
  } catch { return null; }
}

/** Displays an already-authorized projection; privacy must be enforced upstream. */
export function EventLocation({ location, showRoom = true, details = true }: {
  location: ParticipantLocation | null;
  showRoom?: boolean;
  /** Compact table cells leave address and joining credentials in the day header. */
  details?: boolean;
}) {
  if (!location) return null;
  if (location.restricted) return <p className="whitespace-pre-wrap wrap-anywhere">{location.public_summary}</p>;
  const map = safeLink(location.map_url);
  const meeting = safeLink(location.meeting_url);
  return <div className="flex min-w-0 flex-col items-start gap-1 text-small wrap-anywhere">
    {location.type !== "online" && <>
      {location.building && <p>{location.building}</p>}
      {showRoom && location.room && <p>{location.room}</p>}
      {details && location.address && <p>{location.address}</p>}
      {details && map && <Button asChild variant="link" className="h-auto max-w-full whitespace-normal px-0"><a href={map} target="_blank" rel="noopener noreferrer">View on map</a></Button>}
    </>}
    {!details && location.type !== "in_person" && <p>Online</p>}
    {details && location.type !== "in_person" && <>
      {meeting ? <Button asChild variant="link" className="h-auto max-w-full whitespace-normal px-0"><a href={meeting} target="_blank" rel="noopener noreferrer">Join online meeting</a></Button> : <p>Online</p>}
      {location.meeting_id && <div className="max-w-full"><p>Meeting ID</p><CopyCode code={location.meeting_id} label="Copy meeting ID" /></div>}
      {location.meeting_passcode && <div className="max-w-full"><p>Passcode</p><CopyCode code={location.meeting_passcode} label="Copy meeting passcode" /></div>}
    </>}
  </div>;
}
