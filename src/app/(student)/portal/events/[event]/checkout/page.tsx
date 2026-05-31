import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckoutSummaryCard } from "@/components/shared/CheckoutSummaryCard";
import { requireAuth } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/queries/checkout";

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
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const isMember = Boolean(user.membership_type_id);
  const price = isMember ? event.member_price : event.regular_price;
  const formattedPrice = formatCurrency(price);
  const formattedMemberPrice = formatCurrency(event.member_price);
  const formattedRegularPrice = formatCurrency(event.regular_price);
  const formattedDate = formatDate(event.start_date);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/portal/events">Back to Events</Link>
        </Button>
      </div>

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
                <CardTitle className="text-3xl">{event.name}</CardTitle>
                <p className="text-2xl font-semibold text-primary">
                  {formattedPrice}
                </p>
                {event.member_price !== event.regular_price ? (
                  <p className="text-sm text-muted-foreground">
                    Regular: {formattedRegularPrice} | Member:{" "}
                    {formattedMemberPrice}
                  </p>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
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
            description={`Review your ticket for ${event.name}.`}
            buttonLabel="Checkout Coming Soon"
          />
        </div>
      </div>
    </div>
  );
}
