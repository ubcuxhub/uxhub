import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEventRegistrationByPurchaseId } from "@/lib/supabase-helpers/event-registrations";
import { fetchPurchaseForUser } from "@/lib/supabase-helpers/purchases";

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const { purchaseId } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const purchase = await fetchPurchaseForUser(supabase, user.id, purchaseId);

  if (!purchase) {
    notFound();
  }

  const registration =
    purchase.kind === "event_ticket"
      ? await fetchEventRegistrationByPurchaseId(supabase, purchase.id)
      : null;

  const title =
    purchase.kind === "membership"
      ? purchase.membership_types?.name || "Membership purchase"
      : purchase.events?.name || "Event ticket";

  return (
    <PageContainer backHref="/portal/purchases" backLabel="Back to Purchases">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle className="text-3xl">{title}</CardTitle>
          <Badge variant="secondary">{purchase.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <p className="text-muted-foreground">Purchase type</p>
              <p className="font-medium">
                {purchase.kind === "membership"
                  ? "Annual membership"
                  : "Event ticket"}
              </p>
            </div>

            <div className="rounded-md border p-4">
              <p className="text-muted-foreground">Amount</p>
              <p className="font-medium">
                {formatCurrency(purchase.amount_cents, purchase.currency)}
              </p>
            </div>

            <div className="rounded-md border p-4">
              <p className="text-muted-foreground">Purchased at</p>
              <p className="font-medium">
                {formatTimestamp(purchase.created_at)}
              </p>
            </div>

            <div className="rounded-md border p-4">
              <p className="text-muted-foreground">Fulfilled at</p>
              <p className="font-medium">
                {formatTimestamp(purchase.fulfilled_at)}
              </p>
            </div>
          </div>

          {purchase.failure_reason ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive">
              {purchase.failure_reason}
            </div>
          ) : null}

          {purchase.kind === "membership" ? (
            <div className="rounded-md border p-4">
              <p className="text-muted-foreground">Membership status</p>
              <p className="font-medium">
                {purchase.fulfilled_at
                  ? "Membership access has been granted."
                  : "Membership fulfillment is still in progress."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border p-4">
              <p className="text-muted-foreground">Ticket status</p>
              <p className="font-medium">
                {registration?.attending
                  ? "Your ticket has been issued and linked to your event registration."
                  : "We are still syncing your ticket status."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
