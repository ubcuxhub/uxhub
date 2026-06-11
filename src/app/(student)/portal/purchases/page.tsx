import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchPurchasesForUser } from "@/lib/supabase-helpers/purchases";

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

export default async function PurchasesPage() {
  const user = await requireAuth();
  const supabase = await createClient();
  const purchases = await fetchPurchasesForUser(supabase, user.id);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Purchases</h1>
          <p className="text-sm text-muted-foreground">
            View your completed memberships and event tickets.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/portal/events">Back to Portal</Link>
        </Button>
      </div>

      {purchases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            You do not have any purchases yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase) => {
            const title =
              purchase.kind === "membership"
                ? purchase.membership_types?.name || "Membership purchase"
                : purchase.events?.name || "Event ticket";

            return (
              <Card key={purchase.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatTimestamp(purchase.created_at)}
                    </p>
                  </div>
                  <Badge variant="secondary">{purchase.status}</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 text-muted-foreground">
                    <p>
                      Type:{" "}
                      {purchase.kind === "membership"
                        ? "Annual membership"
                        : "Event ticket"}
                    </p>
                    <p>
                      Amount:{" "}
                      {formatCurrency(purchase.amount_cents, purchase.currency)}
                    </p>
                  </div>

                  <Button asChild>
                    <Link href={`/portal/purchases/${purchase.id}`}>
                      View purchase
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
