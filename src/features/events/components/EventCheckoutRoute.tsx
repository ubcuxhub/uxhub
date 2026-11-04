import { notFound } from "next/navigation";

import { EventCheckout } from "@/features/events/components/EventCheckout";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchUserEventApplication } from "@/lib/supabase-helpers/event-applications";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchUserEventTicket } from "@/lib/supabase-helpers/event-tickets";
import { withReturnTo } from "@/lib/auth/paths";
import { formatEventDate } from "@/lib/date";
import { formatReservationFailure } from "@/features/payments/fulfillment-rules";
import type { EventApplicationRow } from "@/lib/supabase/models";

/**
 * Why this person cannot buy a ticket yet, or null when they can. An event
 * that requires an application sells only on an accepted, unexpired offer.
 * reserve_event_ticket enforces the same at checkout.
 */
function getCheckoutBlock(
  requiresApplication: boolean,
  hasTicket: boolean,
  application: EventApplicationRow | null,
  now = Date.now(),
) {
  if (hasTicket) return formatReservationFailure("ALREADY_REGISTERED");
  if (!requiresApplication) return null;
  if (application?.status !== "accepted") {
    return formatReservationFailure("APPLICATION_REQUIRED");
  }
  const expiresAt = application.offer_expires_at
    ? Date.parse(application.offer_expires_at)
    : Number.NaN;
  return expiresAt > now ? null : formatReservationFailure("OFFER_EXPIRED");
}


export async function EventCheckoutRoute({
  returnTo,
  slug,
}: {
  returnTo?: string;
  slug: string;
}) {
  if (!FLAGS.studentEvents) notFound();

  const user = await requireAuth(
    withReturnTo(`/portal/events/${slug}/checkout`, returnTo),
  );
  const supabase = await createClient();
  // No status filter: RLS shows drafts to admins and managers only, who may
  // register for one to test it (docs/event-states.md, "Drafts for admins").
  const event = await fetchEventBySlug(supabase, slug);

  if (!event) notFound();

  const [ticket, application] = await Promise.all([
    fetchUserEventTicket(supabase, event.id, user.id),
    event.requires_application
      ? fetchUserEventApplication(supabase, event.id, user.id)
      : Promise.resolve(null),
  ]);
  const disabledMessage = getCheckoutBlock(
    event.requires_application,
    Boolean(ticket),
    application,
  );

  return (
    <EventCheckout
      disabledMessage={disabledMessage}
      event={event}
      formattedDate={formatEventDate(event.starts_at)}
      returnTo={returnTo}
      slug={event.slug ?? slug}
      user={user}
    />
  );
}
