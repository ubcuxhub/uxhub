import { createClient } from "@/lib/supabase/server";
import { fetchUserEventApplication } from "@/lib/supabase-helpers/event-applications";
import { fetchUserEventTicket } from "@/lib/supabase-helpers/event-tickets";
import type { EventRow } from "@/lib/supabase/models";

import { applicationCallout } from "../lib/application-callout";
import { ApplicationStatusNotice } from "./ApplicationStatusNotice";

interface ApplicationStatusCalloutProps {
  event: Pick<
    EventRow,
    "id" | "name" | "slug" | "requires_application" | "registration_opens_at" | "registration_closes_at"
  >;
  /** The signed-in member's `user_info` id. */
  userId: string;
}

/**
 * The portal event page's application entry point. Renders nothing for an
 * event without applications, or once the member holds a ticket. A server
 * component: it reads the member's application and ticket itself, so the page
 * only places it.
 */
export async function ApplicationStatusCallout({ event, userId }: ApplicationStatusCalloutProps) {
  if (!event.requires_application || !event.slug) return null;

  const supabase = await createClient();
  const [application, ticket] = await Promise.all([
    fetchUserEventApplication(supabase, event.id, userId),
    fetchUserEventTicket(supabase, event.id, userId),
  ]);
  const callout = applicationCallout({ event, application, hasTicket: Boolean(ticket) });
  if (!callout) return null;

  return (
    <ApplicationStatusNotice
      callout={callout}
      eventName={event.name}
      eventSlug={event.slug}
      registrationOpensAt={event.registration_opens_at}
      registrationClosesAt={event.registration_closes_at}
    />
  );
}
