"use client";
import type { MembershipTypeRow } from "@/features/memberships";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { fetchMembershipTypes } from "@/lib/supabase-helpers/memberships";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { PageContainer } from "@/components/shared/PageContainer";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export default function MembershipsPage() {
  const router = useRouter();
  const { user } = useUser();
  const [membershipTiers, setMembershipTiers] = useState<MembershipTypeRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembershipTiers = async () => {
      const supabase = createClient();
      try {
        const data = await fetchMembershipTypes(supabase, { orderBy: "price" });
        setMembershipTiers(data);
      } catch (error) {
        console.error("Error fetching membership tiers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembershipTiers();
  }, []);

  if (loading || !user) {
    return <div>Loading memberships...</div>;
  }

  const membershipExpiryLabel = user.membership_expires_at
    ? new Date(user.membership_expires_at).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  // Determine if a user can purchase a specific tier
  const canPurchase = (tierName: string): boolean => {
    // If user already has a membership, they cannot purchase any
    if (user.membership_type_id || user.membership_pre_ordered_type_id) {
      return false;
    }

    const lowerName = tierName.toLowerCase();

    if (user.user_type === "ubcStudent" && user.student_number) {
      return lowerName.includes("explorer") || lowerName.includes("innovator");
    }

    if (user.user_type === "faculty") {
      return lowerName.includes("faculty");
    }

    if (user.user_type === "nonUbc") {
      return lowerName.includes("non"); // matches "Non-UBC"
    }

    return false;
  };

  return (
    <PageContainer>
        <h1 className="mb-8 text-center text-h1">
          Choose Your Membership
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {membershipTiers.map((tier) => {
            const isCurrent = user.membership_type_id === tier.id;
            const isPurchasable = canPurchase(tier.name);
            const formattedPrice = new Intl.NumberFormat("en-CA", {
              style: "currency",
              currency: "CAD",
            }).format(tier.price);

            return (
              <Card
                key={tier.id}
                className={cn(
                  "flex flex-col h-full relative overflow-hidden transition-all duration-200 hover:shadow-md",
                  isCurrent && "border-primary ring-1 ring-primary bg-primary/5"
                )}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-badge px-3 py-1 rounded-bl-lg">
                    Current Plan
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription className="text-h2 font-bold text-primary mt-2">
                    {formattedPrice}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-muted-foreground text-small mb-6">
                    {tier.description}
                  </p>
                  {tier.features && tier.features.length > 0 && (
                    <ul className="space-y-2">
                      {tier.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-small text-muted-foreground"
                        >
                          <Check className="text-primary mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                      disabled={!isPurchasable}
                      onClick={() => {
                        if (!isCurrent) {
                          router.push(`/portal/membership/${tier.slug}/checkout`);
                        }
                      }}
                    >
                    {isCurrent
                      ? membershipExpiryLabel
                        ? `Active until ${membershipExpiryLabel}`
                        : "Current Plan"
                      : isPurchasable
                      ? "Purchase"
                      : "Not Available"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
    </PageContainer>
  );
}
