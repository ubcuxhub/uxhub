import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EventPageStatus } from "@/features/events/components/EventPageStatus";

const CONTACT_EMAIL = "ubcuxhub@gmail.com";

/**
 * The event isn't there for this member (Figma 1.20). `fetchEventBySlug`
 * returns null when the row was deleted, when it went back to draft (RLS
 * shows drafts to staff only) and when the slug never existed, and the page
 * calls notFound() for each. A failed query throws instead and reaches
 * error.tsx. A canceled event is still found: its page shows it as canceled.
 */
export default function EventNotFound() {
  return (
    <EventPageStatus
      title="This event is no longer available"
      description={
        <>
          {"The UX Hub team removed it, so its page and tickets are gone. You don’t need to do anything. Questions about a ticket you paid for? Email the UX Hub team at "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </>
      }
      action={
        <Button asChild>
          <Link href="/portal/events">Browse events</Link>
        </Button>
      }
    />
  );
}
