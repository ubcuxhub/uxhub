import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckoutSummaryCard } from "@/components/shared/CheckoutSummaryCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicationQuestions } from "@/lib/supabase-helpers/event-applications";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchUserRegistration } from "@/lib/supabase-helpers/event-registrations";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

function formatDate(date: string | null) {
  if (!date) {
    return null;
  }

  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface EventCheckoutPageProps {
  params: Promise<{ event: string }>;
}

export default async function EventCheckoutPage({
  params,
}: EventCheckoutPageProps) {
  const { event: slug } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const event = await fetchEventBySlug(supabase, slug);

  if (!event) {
    notFound();
  }

  const isMember = Boolean(user.membership_type_id);
  const price = isMember ? event.member_price : event.regular_price;
  const formattedPrice = formatCurrency(price);
  const amountCents = Math.round(price * 100);
  const formattedMemberPrice = formatCurrency(event.member_price);
  const formattedRegularPrice = formatCurrency(event.regular_price);
  const formattedDate = formatDate(event.start_date);
  const [applicationQuestions, existingRegistration] = await Promise.all([
    fetchApplicationQuestions(supabase, event.id),
    fetchUserRegistration(supabase, event.id, user.id),
  ]);
  const isDirectPurchaseEvent = applicationQuestions.length === 0;

  let disabledMessage: string | null = null;

  if (!isDirectPurchaseEvent) {
    disabledMessage =
      "This event uses an application flow and cannot be purchased directly.";
  } else if (existingRegistration) {
    disabledMessage = "You already have a registration for this event.";
  }

  return (
    <PageContainer
      backHref={`/events/${event.slug ?? slug}`}
      backLabel="Back to event"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {formattedDate ? (
                  <Badge variant="secondary">{formattedDate}</Badge>
                ) : null}
                {event.location_building ? (
                  <Badge variant="outline">{event.location_building}</Badge>
                ) : null}
                {isMember && event.member_price !== event.regular_price ? (
                  <Badge>Member Price Applied</Badge>
                ) : null}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-h1">{event.name}</CardTitle>
                <p className="text-h2 text-primary">
                  {formattedPrice}
                </p>
                {event.member_price !== event.regular_price ? (
                  <p className="text-small text-muted-foreground">
                    Regular: {formattedRegularPrice} | Member:{" "}
                    {formattedMemberPrice}
                  </p>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-small text-muted-foreground">
                {event.description}
              </p>
              {event.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.image_url}
                  alt={event.name}
                  className="w-full rounded-lg border object-cover"
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <CheckoutSummaryCard
            amount={formattedPrice}
            amountCents={amountCents}
            description={`Review your ticket for ${event.name}.`}
            buttonLabel="Purchase Ticket"
            disabled={!isDirectPurchaseEvent || Boolean(existingRegistration)}
            disabledMessage={disabledMessage}
            initialEmail={user.email}
            initialName={user.name}
            initialPhone={user.phone}
            kind="event_ticket"
            slug={event.slug ?? slug}
          />
        </div>
      </div>
    </PageContainer>
  );
}
