import { notFound } from "next/navigation";

import { EventCheckout } from "@/features/events/components/EventCheckout";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicationQuestions } from "@/lib/supabase-helpers/event-applications";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchUserRegistration } from "@/lib/supabase-helpers/event-registrations";
import { withReturnTo } from "@/lib/auth/paths";

function formatDate(date: string | null) {
  return date
    ? new Date(date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
}

export async function EventCheckoutRoute({
  returnTo,
  slug,
}: {
  returnTo?: string;
  slug: string;
}) {
  const user = await requireAuth(
    withReturnTo(`/portal/events/${slug}/checkout`, returnTo),
  );
  const supabase = await createClient();
  const event = await fetchEventBySlug(supabase, slug);

  if (!event) notFound();

  const [applicationQuestions, existingRegistration] = await Promise.all([
    fetchApplicationQuestions(supabase, event.id),
    fetchUserRegistration(supabase, event.id, user.id),
  ]);
  const isDirectPurchaseEvent = applicationQuestions.length === 0;
  const disabledMessage = !isDirectPurchaseEvent
    ? "This event uses an application flow and cannot be purchased directly."
    : existingRegistration
      ? "You already have a registration for this event."
      : null;

  return (
    <EventCheckout
      disabledMessage={disabledMessage}
      event={event}
      formattedDate={formatDate(event.start_date)}
      hasExistingRegistration={Boolean(existingRegistration)}
      isDirectPurchaseEvent={isDirectPurchaseEvent}
      slug={event.slug ?? slug}
      user={user}
    />
  );
}
