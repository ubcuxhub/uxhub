"use client";

import Link from "next/link";
import { CalendarDays, DollarSign, MapPin, User } from "lucide-react";
import { SiNotion } from "react-icons/si";
import { Composition } from "@/app/dev/_shell/Specimen";
import { EventBanner } from "@/components/shared/EventBanner";
import { EventPreview, EventPreviewSkeleton } from "@/components/shared/EventPreview";
import { QuickLink } from "@/components/shared/QuickLink";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Hubbo } from "@/components/shared/Hubbo";

const href = "/dev/components/event-preview";
const art = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200'%3E%3Crect width='800' height='200' fill='%23325dc4'/%3E%3Ccircle cx='600' cy='100' r='180' fill='%23c983c7'/%3E%3C/svg%3E";
const facts = [
  { label: "Date", icon: CalendarDays, value: "November 7–21, 2026" },
  { label: "Location", icon: MapPin, value: "AMS Nest, Room 2314" },
  { label: "Tickets and capacity", icon: User, value: "40/50 spots" },
  { label: "Price", icon: DollarSign, value: "Free for members, $10.00 for non-members" },
];
function Preview({ long = false }: { long?: boolean }) {
  return <EventPreview title={long ? "Design Sprint with a very long event title that wraps across several lines" : "Design Sprint"} href={href}
    description="Two week team-based UX design challenge. Attendees tackle a real-world prompt and gain hands-on experience alongside fellow creatives."
    banner={{ src: art }} status={<StatusBadge status="registration_open" />} facts={facts}
    actions={<>{["Check-in", "Applications", "Edit event", "View full page"].map((label, i) => <Button key={label} variant={i === 0 ? "primary" : "secondary"} asChild><Link href={href}>{label}</Link></Button>)}</>} />;
}
export default function EventPreviewDemo() {
  return <div className="space-y-10">
    <Composition title="Wide preview" description="A 200px banner, independent bordered details and two-column actions. Feature code owns state, facts and destinations."><div className="max-w-2xl"><Preview /></div></Composition>
    <Composition title="Phone and long copy" description="At 350px, text wraps and actions stack; content grows without clipping."><div className="max-w-87.5"><Preview long /></div></Composition>
    <Composition title="Missing and broken artwork" description="Failed URLs fall back in the same frame. A configured header colour remains visible."><div className="grid gap-4 sm:grid-cols-2"><EventBanner /><EventBanner src="/missing-event-banner.png" colour="#325DC4" /></div></Composition>
    <Composition title="Loading"><div className="max-w-xl"><EventPreviewSkeleton /></div></Composition>
    <Composition title="Empty and error" description="Resting or thinking artwork and secondary recovery actions. The feature supplies callbacks."><div className="grid gap-4 sm:grid-cols-2">{[false, true].map(failed => <Card key={String(failed)} className="justify-center py-0 shadow-none"><EmptyState media={<Hubbo emotion={failed ? "thinking" : "resting"} />} title={failed ? "We couldn’t load the upcoming event" : "No upcoming events"} description={failed ? "Something went wrong on our side. Try again in a moment." : "Create an event and its date, location and spots will show up here."} actions={<Button variant="secondary">{failed ? "Try again" : "Create event"}</Button>} /></Card>)}</div></Composition>
    <Composition title="Quick links" description="Centred service content; two columns on phones. Disabled tiles explain availability on keyboard focus and hover."><div className="grid max-w-md grid-cols-2 gap-4"><QuickLink title="Notion" description="Planning" icon={<SiNotion />} href="https://example.com" /><QuickLink title="Drive" description="Files" icon={<User />} href={null} unavailable="Google Drive link coming soon" /></div></Composition>
  </div>;
}
